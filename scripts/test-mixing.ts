import { getShoppingList, getAcrylicRecipe, getStandardHex } from "../lib/colors/mixing";

// Mock palette containing Hooker's Green (which caused the bug)
// Hooker's Hex: #49796B
const paletteHexes = [
    "#49796B", // Exact Hooker's Green
    "#F6F9FA"  // Titanium White
];

console.log("--- Testing Recipe Generation ---");
const recipe = getAcrylicRecipe("#49796B");
console.log(`Recipe for Hooker's Green: ${recipe}`);

console.log("\n--- Testing Shopping List Parsing ---");
const list = getShoppingList(paletteHexes);
console.log("Shopping List Items:", list);

if (list.includes("&")) {
    console.error("FAIL: List contains spurious '&'!");
    process.exit(1);
}

if (!list.includes("Hooker's Green")) {
    console.error("FAIL: List missing 'Hooker's Green'!");
    process.exit(1);
}

console.log("SUCCESS: Parsing logic handles apostrophes correctly.");
