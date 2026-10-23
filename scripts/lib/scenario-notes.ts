/**
 * Notes for scenario reports, written the way residents type them (es-MX). A note matches
 * the category, the severity and, for "other", what the photo shows. About 4 in 10 reports
 * carry no note, like real ones.
 */
import type { ReportCategory, SeverityDetail } from "@/config/categories";
import type { DemoCity } from "@/config/demo-photos";

export type NoteContext = {
  city: DemoCity;
  category: ReportCategory;
  waterDepthCm: number | null;
  severityDetail: SeverityDetail | null;
  /** Photo file name without extension, e.g. "arbol-caido". */
  photo: string;
  street: string | null;
  colonia: string | null;
  /** Waterway name for canal reports ("el dren", "el Arroyo de la Plata"). */
  waterway: string | null;
  /** Notes specific to the hotspot, from the scenario city config. */
  local: readonly string[];
};

type Pool = readonly string[];

const FLOODED: Record<number, Pool> = {
  5: [
    "Se encharca toda la esquina, hay que brincar para cruzar.",
    "Poquita agua pero no se va, la coladera no jala.",
    "Charco grande frente a la parada del camión.",
    "Todavía se puede pasar, pero con cuidado.",
    "se junta el agua aqui cada que llueve",
  ],
  15: [
    "El agua ya llega a la banqueta. Los carros pasan rápido y mojan a la gente.",
    "No se puede cruzar a pie, los niños de la primaria no pueden pasar.",
    "Agua hasta el tobillo en {street}.",
    "Cada que llueve pasa lo mismo en esta cuadra.",
    "Ya se metió el agua a la cochera de los vecinos.",
    "Los carros hacen olas y el agua entra a las casas.",
  ],
  45: [
    "El agua llega a la rodilla. No pasen por {street}.",
    "Ya se metió el agua a varias casas de la cuadra.",
    "Los carros chicos se están quedando parados.",
    "Agua hasta media llanta, mejor rodeen por otra calle.",
    "Ya no pasa el transporte por aquí.",
    "Sacando muebles, el agua sigue subiendo.",
  ],
  80: [
    "Hay carros flotando, el agua pasa la cintura.",
    "Familias atrapadas en sus casas, el agua no deja salir.",
    "Esto parece río. Urge una bomba para sacar el agua.",
    "Se quedó varado un carro con gente adentro, ya pedimos ayuda al 911.",
    "NO PASEN. Está muy hondo y hay corriente.",
  ],
};

const FLOODED_CITY: Record<DemoCity, Pool> = {
  matamoros: [
    "Otra vez inundados en {colonia}. La Junta de Aguas no ha venido.",
    "El agua no tiene para dónde irse, el dren está lleno.",
    "Desde la última lluvia la calle no ha secado, ya hay zancudos.",
  ],
  zacatecas: [
    "Baja mucha agua del cerro y se junta en {street}.",
    "La corriente arrastra piedras y lodo, cuidado en la bajada.",
    "La avenida se volvió río otra vez.",
    "Con el granizo se taparon las coladeras y se inundó la calle.",
  ],
};

const BLOCKED: Record<SeverityDetail, Pool> = {
  partial: [
    "La rejilla está medio tapada con hojas y bolsas.",
    "Tiene basura encima, todavía pasa algo de agua.",
    "Se está juntando arena en la coladera.",
  ],
  full: [
    "Coladera completamente tapada de basura, cuando llueve se hace laguna.",
    "Está tapada de lodo desde la última lluvia, nadie la ha limpiado.",
    "Tiran basura aquí y tapa todo. Urge limpiarla antes de que llueva.",
    "La alcantarilla está llena de tierra, ya casi no se ve la rejilla.",
  ],
  damaged: [],
  missing: [],
};

const BLOCKED_ANY: Pool = [
  "Lo reporté hace semanas y sigue igual.",
  "Esta coladera es la que inunda toda la cuadra.",
  "Frente a la escuela. Cuando llueve los niños no pueden pasar.",
];

const BLOCKED_CITY: Record<DemoCity, Pool> = {
  matamoros: [
    "El pasto y la basura tapan la entrada al dren.",
    "Se junta lirio y basura en la boca de la tubería.",
  ],
  zacatecas: [
    "El granizo y las hojas taparon la coladera.",
    "Bajó lodo del cerro y tapó la rejilla.",
  ],
};

const COVER: Record<SeverityDetail, Pool> = {
  damaged: [
    "La tapa está rota y se hunde cuando pasan los carros.",
    "Rejilla quebrada, ya se atoró una llanta.",
    "La tapa está floja y truena cada que pasa un carro.",
  ],
  missing: [
    "Registro sin tapa, alguien le puso un palo para avisar. Muy peligroso de noche.",
    "Se robaron la tapa de la alcantarilla. Ya se cayó un señor en bicicleta.",
    "Pozo abierto en plena calle, cuando llueve no se ve.",
    "Le pusimos una llanta encima para que nadie se caiga.",
    "Con la corriente se botó la tapa y nadie la ha vuelto a poner.",
  ],
  partial: [],
  full: [],
};

const COVER_ANY: Pool = [
  "Frente a la primaria, pasan muchos niños.",
  "Por favor pongan aunque sea un señalamiento.",
];

const SEWAGE: Pool = [
  "Brota agua negra de la coladera desde la mañana. Huele muy fuerte.",
  "Se regresa el drenaje a las casas cuando llueve.",
  "Hay aguas negras en toda la calle y los niños pasan por ahí para ir a la escuela.",
  "El registro se desborda cada vez que llueve.",
  "Ya van tres días con el drenaje brotado.",
  "huele horrible, ya no se puede ni abrir la ventana",
];

const CANAL: Record<DemoCity, Pool> = {
  matamoros: [
    "{waterway} ya se salió, el agua llega a las casas de enfrente.",
    "El dren está lleno de basura y lirio, el agua no corre.",
    "El agua de {waterway} ya está al ras de la calle.",
    "No lo han desazolvado y cada lluvia se sale.",
    "Se ve la corriente muy fuerte, no dejen que los niños se acerquen.",
  ],
  zacatecas: [
    "{waterway} trae mucha agua y basura, ya se salió en el puente.",
    "La corriente de {waterway} está muy fuerte, no se acerquen.",
    "El arroyo arrastra llantas y ramas, se está tapando el puente.",
    "Hay descargas de drenaje al arroyo, huele horrible.",
  ],
};

/** "Other" notes describe what the photo shows. */
const OTHER: Record<string, Pool> = {
  "granizo-en-autos": [
    "Cayó una granizada muy fuerte, las calles quedaron blancas y las coladeras tapadas.",
    "Granizo acumulado, cuando se derrita va a inundar la calle.",
  ],
  "bache-con-agua": [
    "Bache enorme lleno de agua, los carros caen y no se ve.",
    "Se hizo un hoyo con la lluvia, ya se ponchó una llanta.",
  ],
  "arbol-en-calle-inundada": [
    "Se cayó un árbol en la calle inundada, no se puede pasar.",
    "Árbol caído tapando la corriente del agua.",
  ],
  "arbol-caido": [
    "Se cayó un árbol con el viento, está sobre la banqueta y los cables.",
    "Árbol caído, ya pusieron cinta pero nadie lo ha quitado.",
  ],
  "basura-tras-inundacion": [
    "Mucha basura y muebles mojados en la calle después de la inundación.",
    "La basura que sacaron de las casas está tapando las coladeras.",
  ],
  "calle-deslavada": [
    "La lluvia se llevó la calle, quedó pura piedra y zanjas.",
    "Calle deslavada, los carros ya no pueden subir.",
  ],
  "charco-estancado": [
    "Agua estancada desde hace días, ya hay larvas de mosquito.",
    "Este charco no se seca nunca. Con el dengue da miedo.",
  ],
};

const OTHER_ANY: Pool = ["No sé a quién reportarlo, pero es un peligro."];

function fill(template: string, ctx: NoteContext): string | null {
  const values: Record<string, string | null> = {
    street: ctx.street,
    colonia: ctx.colonia,
    waterway: ctx.waterway,
  };
  let missing = false;
  const text = template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = values[key];
    if (!value) missing = true;
    return value ?? "";
  });
  if (missing) return null;
  // "{waterway} ya se salió" starts lowercase for generic names ("el arroyo").
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function candidates(ctx: NoteContext): Pool {
  switch (ctx.category) {
    case "flooded_street":
      return [
        ...(FLOODED[ctx.waterDepthCm ?? 15] ?? []),
        ...FLOODED_CITY[ctx.city],
      ];
    case "blocked_drain":
      return [
        ...(ctx.severityDetail ? BLOCKED[ctx.severityDetail] : []),
        ...BLOCKED_ANY,
        ...BLOCKED_CITY[ctx.city],
      ];
    case "broken_cover":
      return [
        ...(ctx.severityDetail ? COVER[ctx.severityDetail] : []),
        ...COVER_ANY,
      ];
    case "sewage_backflow":
      return SEWAGE;
    case "overflowing_canal":
      return CANAL[ctx.city];
    case "other":
      return OTHER[ctx.photo] ?? OTHER_ANY;
  }
}

/** A note for the report, or null (no note). `roll` is a uniform [0, 1) source. */
export function scenarioNote(
  ctx: NoteContext,
  roll: () => number,
): string | null {
  // Photos of "other" problems need words; the rest often go without.
  const p = ctx.category === "other" ? 0.9 : 0.6;
  if (roll() >= p) return null;
  const pool =
    ctx.category !== "other" && ctx.local.length && roll() < 0.45
      ? ctx.local
      : candidates(ctx);
  for (let attempt = 0; attempt < 4; attempt++) {
    const template = pool[Math.floor(roll() * pool.length)];
    const text = template ? fill(template, ctx) : null;
    if (text) return text;
  }
  return null;
}
