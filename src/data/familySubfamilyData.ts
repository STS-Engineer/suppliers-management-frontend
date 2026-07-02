export const ALL_COMMODITIES = [
  "Plastic and Stamping",
  "Wire",
  "Material",
  "Electronics",
  "Sintered Parts",
  "Other",
];

export const COMMODITY_FAMILIES: Record<string, string[]> = {
  "Plastic and Stamping": ["Stamping_Deep_Drawing", "Molding"],
  "Wire": ["Enameled_Wire", "Copper_Wire"],
  "Material": ["Graphite", "Metallic_Powder", "Resin", "Adhesive", "Solder_Materials", "Other material"],
  "Electronics": ["Electronic", "Ferrite"],
  "Sintered Parts": ["Sintered_Part"],
  "Other": ["Machined_Part", "Spring", "Packaging", "Other"],
};

/** Returns families available for the given selected commodities.
 *  If no commodities are selected, returns the full family list. */
export function getFamiliesForCommodities(commodities: string[]): string[] {
  if (commodities.length === 0) return ALL_FAMILIES;
  return [...new Set(commodities.flatMap((c) => COMMODITY_FAMILIES[c] ?? []))];
}

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

/** Converts internal underscore keys to human-readable labels.
 *  e.g. "Sintered_Part" → "Sintered Part", "Stamping_Deep_Drawing" → "Stamping Deep Drawing"
 *  Sub-family values are already readable strings — this is a no-op for them. */
export const toDisplayLabel = (key: string): string => key.replace(/_/g, " ");
