"""
NaijaMarket Intel — Phase B: Price Scraper Azure Function
=========================================================
Timer-triggered function that runs daily at 07:00 WAT (06:00 UTC)
before the Logic Apps fire at 08:30 WAT.

Scrapes:
  1. AFEX Commodities Exchange (structured API, ~15 commodities)
  2. NBS Monthly Release (checks for new data, ~45 items × 37 states)
  3. PricePatrol.ng (crowd-sourced prices, limited coverage)

Pipeline:
  Scrape → Raw_Price_Feeds → Validate → Item_Name_Map → Verified_External_Prices
  
The SP (sp_Generate_Daily_Prices) then checks Verified_External_Prices
before generating simulated prices. Real data wins.
"""

import logging
import json
import os
import pyodbc
import requests
from datetime import datetime, date, timedelta
from decimal import Decimal
from bs4 import BeautifulSoup

# ============================================================================
# CONFIGURATION
# ============================================================================

SQL_CONFIG = {
    'server': os.environ.get('SQL_SERVER', 'naijafood.database.windows.net'),
    'database': os.environ.get('SQL_DATABASE', 'naijafoodmarket'),
    'username': os.environ.get('SQL_USERNAME', ''),
    'password': os.environ.get('SQL_PASSWORD', ''),
}

# Outlier threshold: reject prices >40% away from our baseline
OUTLIER_THRESHOLD = 0.40

# Request timeout (seconds)
REQUEST_TIMEOUT = 30

# User agent for web scraping
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.5',
}


# ============================================================================
# DATABASE CONNECTION
# ============================================================================

def get_db_connection():
    """Get pyodbc connection to Azure SQL."""
    conn_str = (
        f"DRIVER={{ODBC Driver 18 for SQL Server}};"
        f"SERVER={SQL_CONFIG['server']};"
        f"DATABASE={SQL_CONFIG['database']};"
        f"UID={SQL_CONFIG['username']};"
        f"PWD={SQL_CONFIG['password']};"
        f"Encrypt=yes;TrustServerCertificate=no;"
    )
    return pyodbc.connect(conn_str, timeout=30)


# ============================================================================
# SCRAPER 1: AFEX COMMODITIES EXCHANGE
# ============================================================================

def scrape_afex(conn, price_date):
    """
    Scrape AFEX commodity prices from amass.afex.africa
    
    AFEX publishes daily closing prices for:
    - Maize (White/Yellow), Sorghum (White/Red), Soybean
    - Sesame Seed, Paddy Rice, Cocoa, Ginger, Cashew Nut
    
    Prices are per metric ton in NGN.
    """
    logging.info("=== AFEX Scraper Starting ===")
    results = {'scraped': 0, 'mapped': 0, 'rejected': 0, 'errors': []}
    
    try:
        # AFEX market data endpoint
        url = "https://amass.afex.africa/api/commodities/prices"
        
        # Try primary API
        try:
            response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = response.json()
        except Exception:
            # Fallback: scrape the web page
            logging.info("AFEX API failed, trying web scrape fallback")
            url_fallback = "https://amass.afex.africa"
            response = requests.get(url_fallback, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
            data = parse_afex_html(response.text)
        
        if not data:
            logging.warning("No data returned from AFEX")
            results['errors'].append("No data from AFEX")
            return results
        
        cursor = conn.cursor()
        
        for item in data:
            try:
                commodity_name = item.get('commodity', item.get('name', ''))
                price = item.get('price', item.get('closing_price', 0))
                unit = item.get('unit', 'per ton')
                
                if not commodity_name or not price:
                    continue
                
                price = float(price)
                
                # Insert into Raw_Price_Feeds
                cursor.execute("""
                    INSERT INTO staging.Raw_Price_Feeds 
                    (source, price_date, raw_item_name, raw_price, raw_unit, 
                     raw_location, raw_state, raw_json, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
                """, 
                    'AFEX', price_date, commodity_name, price, unit,
                    'National', 'National',
                    json.dumps(item)
                )
                results['scraped'] += 1
                
            except Exception as e:
                results['errors'].append(f"AFEX item error: {str(e)}")
                continue
        
        conn.commit()
        logging.info(f"AFEX: Scraped {results['scraped']} prices")
        
    except Exception as e:
        results['errors'].append(f"AFEX scraper error: {str(e)}")
        logging.error(f"AFEX scraper failed: {e}")
    
    return results


def parse_afex_html(html):
    """Parse AFEX website HTML to extract commodity prices."""
    soup = BeautifulSoup(html, 'html.parser')
    prices = []
    
    # Look for price table/cards on the AFEX page
    # Structure varies — try multiple selectors
    for row in soup.select('table tbody tr, .commodity-card, .price-row'):
        try:
            cells = row.find_all(['td', '.commodity-name', '.price-value'])
            if len(cells) >= 2:
                name = cells[0].get_text(strip=True)
                price_text = cells[1].get_text(strip=True)
                # Clean price: remove ₦, commas, spaces
                price_clean = price_text.replace('₦', '').replace(',', '').replace(' ', '')
                price = float(price_clean)
                prices.append({
                    'commodity': name,
                    'price': price,
                    'unit': 'per ton'
                })
        except (ValueError, IndexError):
            continue
    
    return prices


# ============================================================================
# SCRAPER 2: NBS (National Bureau of Statistics)
# ============================================================================

def scrape_nbs(conn, price_date):
    """
    Check for new NBS food price releases.
    
    NBS publishes "Selected Food Prices" monthly at:
    https://nigerianstat.gov.ng/elibrary/read/1241465
    
    Data includes ~45 food items with state-level average prices.
    Published ~6 weeks after the reference month.
    
    This scraper:
    1. Checks if there's a new release we haven't processed
    2. If yes, downloads and parses the data
    3. Updates our Items_Catalog wholesale prices (auto-recalibration)
    4. Inserts state-level prices into Verified_External_Prices
    """
    logging.info("=== NBS Scraper Starting ===")
    results = {'scraped': 0, 'mapped': 0, 'new_release': False, 'errors': []}
    
    try:
        # Check NBS e-library for latest food price report
        nbs_url = "https://nigerianstat.gov.ng/elibrary"
        
        try:
            response = requests.get(nbs_url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except Exception as e:
            logging.warning(f"NBS website unreachable: {e}")
            results['errors'].append(f"NBS unreachable: {str(e)}")
            return results
        
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # Look for "Selected Food Prices" or "CPI and Food Price" reports
        food_links = []
        for link in soup.find_all('a', href=True):
            title = link.get_text(strip=True).lower()
            if any(kw in title for kw in ['food price', 'selected food', 'cpi food']):
                food_links.append({
                    'title': link.get_text(strip=True),
                    'url': link['href']
                })
        
        if not food_links:
            logging.info("No new NBS food price reports found")
            return results
        
        cursor = conn.cursor()
        
        # Check which releases we've already processed
        for report in food_links[:3]:  # Check latest 3
            # Extract month/year from title (e.g., "November 2025")
            release_month = extract_month_from_title(report['title'])
            
            if release_month:
                cursor.execute("""
                    SELECT COUNT(*) FROM dbo.NBS_Monthly_Releases 
                    WHERE release_month = ?
                """, release_month)
                
                already_processed = cursor.fetchone()[0]
                
                if already_processed == 0:
                    # NEW RELEASE! Record it
                    cursor.execute("""
                        INSERT INTO dbo.NBS_Monthly_Releases 
                        (release_month, release_title, release_url, status)
                        VALUES (?, ?, ?, 'DETECTED')
                    """, release_month, report['title'], report['url'])
                    
                    results['new_release'] = True
                    logging.info(f"NEW NBS release detected: {report['title']}")
                    
                    # Try to download and parse the report
                    try:
                        nbs_data = download_nbs_report(report['url'])
                        if nbs_data:
                            for item in nbs_data:
                                cursor.execute("""
                                    INSERT INTO staging.Raw_Price_Feeds
                                    (source, price_date, raw_item_name, raw_price, raw_unit,
                                     raw_location, raw_state, raw_json, status)
                                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
                                """,
                                    'NBS', release_month,
                                    item['item_name'], item['price'], item['unit'],
                                    item.get('location', 'National'),
                                    item.get('state', 'National'),
                                    json.dumps(item)
                                )
                                results['scraped'] += 1
                            
                            # Update release status
                            cursor.execute("""
                                UPDATE dbo.NBS_Monthly_Releases 
                                SET status = 'COMPLETED', processed_at = GETDATE(),
                                    items_updated = ?
                                WHERE release_month = ?
                            """, results['scraped'], release_month)
                    
                    except Exception as e:
                        cursor.execute("""
                            UPDATE dbo.NBS_Monthly_Releases 
                            SET status = 'FAILED', notes = ?
                            WHERE release_month = ?
                        """, str(e), release_month)
                        results['errors'].append(f"NBS parse error: {str(e)}")
        
        conn.commit()
        logging.info(f"NBS: Scraped {results['scraped']} prices, new release: {results['new_release']}")
        
    except Exception as e:
        results['errors'].append(f"NBS scraper error: {str(e)}")
        logging.error(f"NBS scraper failed: {e}")
    
    return results


def extract_month_from_title(title):
    """Extract month/year from NBS report title → return first of month as DATE."""
    import re
    months = {
        'january': 1, 'february': 2, 'march': 3, 'april': 4,
        'may': 5, 'june': 6, 'july': 7, 'august': 8,
        'september': 9, 'october': 10, 'november': 11, 'december': 12
    }
    
    title_lower = title.lower()
    for month_name, month_num in months.items():
        if month_name in title_lower:
            # Find year
            year_match = re.search(r'20\d{2}', title)
            if year_match:
                year = int(year_match.group())
                return date(year, month_num, 1)
    
    return None


def download_nbs_report(url):
    """Download and parse NBS food price report (PDF/Excel)."""
    # NBS reports come as PDF or Excel
    # For now, return empty — will implement PDF parser in B4
    logging.info(f"NBS report download not yet implemented: {url}")
    return []


# ============================================================================
# SCRAPER 3: PRICEPATRO.NG
# ============================================================================

def scrape_pricepatrol(conn, price_date):
    """
    Scrape PricePatrol.ng for crowd-sourced food prices.
    
    PricePatrol has user-submitted prices for ~20 items in major cities.
    Lower reliability than AFEX/NBS but fills gaps.
    """
    logging.info("=== PricePatrol Scraper Starting ===")
    results = {'scraped': 0, 'mapped': 0, 'rejected': 0, 'errors': []}
    
    try:
        url = "https://pricepatrol.ng/prices"
        
        try:
            response = requests.get(url, headers=HEADERS, timeout=REQUEST_TIMEOUT)
            response.raise_for_status()
        except Exception as e:
            logging.warning(f"PricePatrol unreachable: {e}")
            results['errors'].append(f"PricePatrol unreachable: {str(e)}")
            return results
        
        soup = BeautifulSoup(response.text, 'html.parser')
        cursor = conn.cursor()
        
        # Parse price listings
        for card in soup.select('.price-card, .product-item, tr.price-row, .item'):
            try:
                # Extract item name, price, location
                name_el = card.select_one('.item-name, .product-name, td:first-child, h3, h4')
                price_el = card.select_one('.item-price, .price, td.price, .amount')
                location_el = card.select_one('.location, .market, td.location, .place')
                
                if not name_el or not price_el:
                    continue
                
                item_name = name_el.get_text(strip=True)
                price_text = price_el.get_text(strip=True)
                location = location_el.get_text(strip=True) if location_el else 'Unknown'
                
                # Clean price
                price_clean = price_text.replace('₦', '').replace('NGN', '').replace(',', '').strip()
                try:
                    price = float(price_clean)
                except ValueError:
                    continue
                
                if price <= 0:
                    continue
                
                # Detect state from location
                state = detect_state(location)
                
                cursor.execute("""
                    INSERT INTO staging.Raw_Price_Feeds
                    (source, price_date, raw_item_name, raw_price, raw_unit,
                     raw_location, raw_state, status)
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING')
                """,
                    'PRICEP', price_date, item_name, price, 'each',
                    location, state
                )
                results['scraped'] += 1
                
            except Exception as e:
                results['errors'].append(f"PricePatrol item: {str(e)}")
                continue
        
        conn.commit()
        logging.info(f"PricePatrol: Scraped {results['scraped']} prices")
        
    except Exception as e:
        results['errors'].append(f"PricePatrol error: {str(e)}")
        logging.error(f"PricePatrol scraper failed: {e}")
    
    return results


def detect_state(location_text):
    """Detect Nigerian state from location string."""
    state_keywords = {
        'Lagos': ['lagos', 'ikeja', 'mile 12', 'lekki', 'victoria island', 'surulere', 'alaba'],
        'FCT': ['abuja', 'wuse', 'garki', 'maitama', 'gwarinpa'],
        'Rivers': ['port harcourt', 'rivers'],
        'Kano': ['kano'],
        'Oyo': ['ibadan', 'oyo'],
        'Anambra': ['onitsha', 'awka', 'nnewi', 'anambra'],
        'Abia': ['aba', 'umuahia', 'ariaria', 'abia'],
        'Kaduna': ['kaduna'],
        'Plateau': ['jos', 'plateau'],
        'Enugu': ['enugu'],
        'Delta': ['warri', 'asaba', 'delta'],
        'Edo': ['benin city', 'edo'],
        'Ogun': ['abeokuta', 'ogun'],
    }
    
    location_lower = location_text.lower()
    for state, keywords in state_keywords.items():
        if any(kw in location_lower for kw in keywords):
            return state
    
    return 'Unknown'


# ============================================================================
# VALIDATION ENGINE
# ============================================================================

def validate_and_map(conn, price_date):
    """
    Process PENDING items in Raw_Price_Feeds:
    1. Map to our Items_Catalog using Item_Name_Map
    2. Normalize prices to our standard units
    3. Check for outliers (>40% deviation from baseline)
    4. Insert valid items into Verified_External_Prices
    """
    logging.info("=== Validation Engine Starting ===")
    results = {'mapped': 0, 'rejected': 0, 'unmapped': 0}
    
    cursor = conn.cursor()
    
    # Get all PENDING feeds
    cursor.execute("""
        SELECT f.feed_id, f.source, f.price_date, f.raw_item_name, 
               f.raw_price, f.raw_unit, f.raw_location, f.raw_state
        FROM staging.Raw_Price_Feeds f
        WHERE f.status = 'PENDING'
        ORDER BY f.feed_id
    """)
    
    pending = cursor.fetchall()
    logging.info(f"Processing {len(pending)} pending feeds")
    
    for row in pending:
        feed_id, source, p_date, raw_name, raw_price, raw_unit, raw_loc, raw_state = row
        
        # Step 1: Look up in Item_Name_Map
        cursor.execute("""
            SELECT m.our_item_id, m.unit_conversion,
                   i.item_name, i.whole_sale_Price, i.Unit
            FROM dbo.Item_Name_Map m
            JOIN dbo.Items_Catalog i ON m.our_item_id = i.item_id
            WHERE m.source = ? AND m.external_name = ?
        """, source, raw_name)
        
        mapping = cursor.fetchone()
        
        if not mapping:
            # No mapping found — mark as unmapped
            cursor.execute("""
                UPDATE staging.Raw_Price_Feeds 
                SET status = 'UNMAPPED', reject_reason = 'No mapping in Item_Name_Map'
                WHERE feed_id = ?
            """, feed_id)
            results['unmapped'] += 1
            continue
        
        our_item_id, unit_conversion, item_name, wholesale_base, unit = mapping
        
        # Step 2: Normalize price
        normalized_price = float(raw_price) * float(unit_conversion)
        
        # Step 3: Check for outliers
        if wholesale_base and wholesale_base > 0:
            deviation = abs(normalized_price - float(wholesale_base)) / float(wholesale_base)
            deviation_pct = round(deviation * 100, 2)
            
            if deviation > OUTLIER_THRESHOLD:
                cursor.execute("""
                    UPDATE staging.Raw_Price_Feeds 
                    SET status = 'REJECTED', 
                        reject_reason = ?,
                        mapped_item_id = ?,
                        normalized_price = ?,
                        deviation_pct = ?
                    WHERE feed_id = ?
                """, 
                    f'Outlier: {deviation_pct}% from baseline ₦{wholesale_base}',
                    our_item_id, normalized_price, deviation_pct, feed_id
                )
                results['rejected'] += 1
                continue
        else:
            deviation_pct = 0
        
        # Step 4: Determine confidence based on source
        confidence = {
            'AFEX': 92,      # Exchange-verified
            'NBS': 95,       # Government stats
            'PRICEP': 75,    # Crowd-sourced
            'JIJI': 65,      # Marketplace listing
            'NEWS': 70,      # News article
        }.get(source, 70)
        
        # Step 5: Find best matching market
        market_id = None
        market_name = None
        if raw_state and raw_state != 'National' and raw_state != 'Unknown':
            cursor.execute("""
                SELECT TOP 1 market_id, market_name
                FROM dbo.Markets
                WHERE state = ?
                ORDER BY market_id
            """, raw_state)
            market = cursor.fetchone()
            if market:
                market_id, market_name = market
        
        # Step 6: Insert into Verified_External_Prices
        cursor.execute("""
            INSERT INTO dbo.Verified_External_Prices
            (source, price_date, item_id, item_name, market_id, market_name,
             state, price_naira, unit, confidence, deviation_pct, feed_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            source, p_date or price_date, our_item_id, item_name,
            market_id, market_name, raw_state,
            normalized_price, unit, confidence, deviation_pct, feed_id
        )
        
        # Step 7: Update raw feed status
        cursor.execute("""
            UPDATE staging.Raw_Price_Feeds 
            SET status = 'MAPPED', 
                mapped_item_id = ?,
                mapped_market_id = ?,
                normalized_price = ?,
                deviation_pct = ?
            WHERE feed_id = ?
        """, our_item_id, market_id, normalized_price, deviation_pct, feed_id)
        
        results['mapped'] += 1
    
    conn.commit()
    logging.info(f"Validation: {results['mapped']} mapped, {results['rejected']} rejected, {results['unmapped']} unmapped")
    
    return results


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def main():
    """
    Main orchestrator — runs all scrapers in sequence.
    
    Called by Azure Function timer trigger at 07:00 WAT (06:00 UTC) daily.
    Also callable manually for testing.
    """
    start_time = datetime.utcnow()
    today = date.today()
    
    logging.info(f"========================================")
    logging.info(f"Phase B Price Scraper — {today}")
    logging.info(f"Started: {start_time.isoformat()}")
    logging.info(f"========================================")
    
    all_results = {
        'date': str(today),
        'scrapers': {},
        'validation': {},
        'errors': [],
        'duration_seconds': 0
    }
    
    conn = None
    try:
        conn = get_db_connection()
        logging.info("Database connected")
        
        # Run scrapers
        all_results['scrapers']['afex'] = scrape_afex(conn, today)
        all_results['scrapers']['nbs'] = scrape_nbs(conn, today)
        all_results['scrapers']['pricepatrol'] = scrape_pricepatrol(conn, today)
        
        # Validate and map all PENDING feeds
        all_results['validation'] = validate_and_map(conn, today)
        
        # Summary
        total_scraped = sum(r.get('scraped', 0) for r in all_results['scrapers'].values())
        total_mapped = all_results['validation'].get('mapped', 0)
        total_rejected = all_results['validation'].get('rejected', 0)
        
        logging.info(f"========================================")
        logging.info(f"SUMMARY: Scraped={total_scraped}, Mapped={total_mapped}, Rejected={total_rejected}")
        
    except Exception as e:
        all_results['errors'].append(str(e))
        logging.error(f"Fatal error: {e}")
    
    finally:
        if conn:
            conn.close()
    
    all_results['duration_seconds'] = (datetime.utcnow() - start_time).total_seconds()
    logging.info(f"Completed in {all_results['duration_seconds']:.1f}s")
    
    return all_results


# ============================================================================
# AZURE FUNCTION HANDLER
# ============================================================================

def run(mytimer):
    """Azure Function timer trigger handler."""
    logging.info('Price scraper timer trigger fired')
    
    if mytimer.past_due:
        logging.info('Timer is past due, running anyway')
    
    result = main()
    logging.info(f"Scraper result: {json.dumps(result, default=str)}")


# Allow direct execution for testing
if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    main()
