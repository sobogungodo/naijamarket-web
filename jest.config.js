module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/lib/scheduler"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
