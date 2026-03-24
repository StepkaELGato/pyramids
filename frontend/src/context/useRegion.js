import { useContext } from "react";
import { RegionContext } from "./region-context.js";

export function useRegion() {
  const ctx = useContext(RegionContext);

  if (!ctx) {
    throw new Error("useRegion must be used inside <RegionProvider>");
  }

  return ctx;
}