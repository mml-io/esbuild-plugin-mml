/** @type {import('ts-jest').JestConfigWithTsJest} **/
import { createDefaultEsmPreset } from "ts-jest";

export default {
  testEnvironment: "node",
  ...createDefaultEsmPreset(),
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
};
