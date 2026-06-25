export const FAMILY_SUBFAMILIES: Record<string, string[]> = {
  Machined_Part: ["Metallic Machined Parts", "Other Machined Parts"],
  Electronic: [
    "Capacitor",
    "Varistor",
    "Copa Varistor",
    "Resistance",
    "Hall Effect Sensor",
    "Circuit Breaker",
    "Pcbs",
    "Pcb",
    "Standard Choke",
    "Fuse Choke",
    "Toroid Choke",
    "Other Choke",
    "Other Electronic",
    "Diode",
  ],
  Stamping_Deep_Drawing: [
    "Stamping Brush Box",
    "Stamping Part",
    "Deep Drawing Parts",
    "Stamping Bakelite",
    "Other Stamping Parts",
  ],
  Molding: [
    "Thermoplastic Molding",
    "Thermoset Molding",
    "Thermoplastic Insert Molding",
    "Thermoset Insert Molding",
    "Elastomer",
    "Other Molding",
    "Busbar",
  ],
  Graphite: [
    "Natural Graphite",
    "Artificial Graphite",
    "Electro Graphite",
    "Other Graphite",
  ],
  Metallic_Powder: [
    "Electrolytic Copper Powder",
    "Mos2",
    "Ws2",
    "Flake Copper Powder",
    "Other Copper Powder",
    "Ferrous Powder",
    "Other Powder",
  ],
  Resin: [
    "Thermoplastic Resin",
    "Thermoset Resin",
    "Bakelite Resin",
    "Other Resin",
  ],
  Ferrite: [
    "Standard Rod Core Ferrite",
    "Fuse Rod Core Ferrite",
    "Toroid Ferrite",
    "Other Ferrite",
  ],
  Spring: ["Compression Spring", "Torsion Spring", "Leaf Spring", "Other Spring"],
  Enameled_Wire: [
    "Round Enameled Copper Wire",
    "Flat Enameled Copper Wire",
    "Other Enameled Wire",
  ],
  Copper_Wire: [
    "Flexible Stranded Copper",
    "Flexible Stranded Tinned Copper",
    "Other Copper Wire",
    "Non-Flexible Copper Wire",
    "Harness",
  ],
  Sintered_Part: [
    "Brush",
    "Ceramic",
    "Graphite Block",
    "Metallic Bushing",
    "Sic",
    "Other Bushing",
    "Other Sintered Part",
  ],
  Adhesive: ["Adhesive tape", "Glue", "Other adhesive"],
  Packaging: ["Cardboard", "Plastic Tray", "Other Packaging"],
  Solder_Materials: [
    "Tin Wire",
    "Tin Bar",
    "Tin Pellet",
    "Tin Silver Wire",
    "Tin Silver Paste",
    "Other Solder Materials",
  ],
  Other: ["Bakelite Sheet", "Catalogue parts", "Sleeve", "Foam", "Lubricant"],
  "Other material": ["Oil", "Chemicals"],
};

export const ALL_FAMILIES = Object.keys(FAMILY_SUBFAMILIES);

export const ALL_SUBFAMILIES = Object.values(FAMILY_SUBFAMILIES).flat();

/** Returns sub-families available for the given selected families.
 *  If no families are selected, returns the full list. */
export function getSubFamiliesForFamilies(families: string[]): string[] {
  if (families.length === 0) return ALL_SUBFAMILIES;
  return [...new Set(families.flatMap((f) => FAMILY_SUBFAMILIES[f] ?? []))];
}
