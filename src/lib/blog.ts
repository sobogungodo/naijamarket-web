// lib/blog.ts
// NaijaMarket Intel - Blog Utility Functions
// Drop this into your src/lib/ folder

import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';

const BLOG_DIR = path.join(process.cwd(), 'content/blog');

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  category: string;
  excerpt: string;
  author: string;
  readTime: string;
  featured: boolean;
  tags: string[];
  content: string;
}

export function getAllPosts(): BlogPost[] {
  if (!fs.existsSync(BLOG_DIR)) return [];

  const files = fs.readdirSync(BLOG_DIR).filter(f => f.endsWith('.md'));

  const posts = files.map(filename => {
    const slug = filename.replace('.md', '');
    const filePath = path.join(BLOG_DIR, filename);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const { data, content } = matter(fileContent);

    return {
      slug,
      title: data.title || '',
      date: data.date || '',
      category: data.category || 'Market Update',
      excerpt: data.excerpt || '',
      author: data.author || 'NaijaMarket Intel Research Team',
      readTime: data.readTime || '5 min read',
      featured: data.featured || false,
      tags: data.tags || [],
      content,
    } as BlogPost;
  });

  // Sort by date descending (newest first)
  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

export function getPostBySlug(slug: string): BlogPost | null {
  const filePath = path.join(BLOG_DIR, `${slug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = matter(fileContent);

  return {
    slug,
    title: data.title || '',
    date: data.date || '',
    category: data.category || 'Market Update',
    excerpt: data.excerpt || '',
    author: data.author || 'NaijaMarket Intel Research Team',
    readTime: data.readTime || '5 min read',
    featured: data.featured || false,
    tags: data.tags || [],
    content,
  };
}

export function getPostsByCategory(category: string): BlogPost[] {
  return getAllPosts().filter(p => p.category === category);
}

export function getFeaturedPosts(): BlogPost[] {
  return getAllPosts().filter(p => p.featured).slice(0, 3);
}

export function getRecentPosts(count = 6): BlogPost[] {
  return getAllPosts().slice(0, count);
}

export function getAllCategories(): string[] {
  const posts = getAllPosts();
  const cats = new Set(posts.map(p => p.category));
  return Array.from(cats);
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
