import { expect } from "vitest";
import { HttpValidationError } from "../http/validation/httpValidation.js";

export const expectValidationError = (callback: () => unknown, path: string): void => {
  let caught: unknown;
  try { callback(); } catch (error) { caught = error; }
  expect(caught).toBeInstanceOf(HttpValidationError);
  expect((caught as HttpValidationError).issues).toEqual(expect.arrayContaining([
    expect.objectContaining({ path })
  ]));
};
