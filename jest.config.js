module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src/lib/scheduler", "<rootDir>/src/lib"],
  moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" },
};
