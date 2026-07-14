import type { ComponentType } from "react";
import { loopNodeStyleCatalog, type LoopNodeStyle } from "@shared/api/workspace-contracts";
import {
  BlackHoleArtwork,
  MeteoriteArtwork,
  SatelliteArtwork,
  SpacemanArtwork
} from "./LoopNodeClassicArtwork";
import {
  BattleStationArtwork,
  BlackIcePlanetArtwork,
  BlackPlanetArtwork,
  FirePlanetArtwork,
  ShatteredPlanetArtwork,
  VectorPlanetArtwork
} from "./LoopNodePlanetArtwork";
import {
  ArrowScoutArtwork,
  CrescentCourierArtwork,
  FangInterceptorArtwork,
  HammerCruiserArtwork,
  NeedleFrigateArtwork,
  TwinPodBomberArtwork
} from "./LoopNodeShipArtwork";
import {
  AstralKrakenArtwork,
  CosmicSerpentArtwork,
  MoonMawArtwork,
  StarJellyArtwork,
  VoidEyeArtwork,
  VoidMantaArtwork
} from "./LoopNodeMonsterArtwork";

type LoopNodeArtworkComponent = ComponentType<Record<string, never>>;

const loopNodeArtworkByStyle: Record<LoopNodeStyle, LoopNodeArtworkComponent | null> = {
  flat: null,
  luna: null,
  "black-hole": BlackHoleArtwork,
  satellite: SatelliteArtwork,
  meteorite: MeteoriteArtwork,
  spaceman: SpacemanArtwork,
  mars: null,
  terra: null,
  sol: null,
  "black-ice-planet": BlackIcePlanetArtwork,
  "black-planet": BlackPlanetArtwork,
  "fire-planet": FirePlanetArtwork,
  "shattered-planet": ShatteredPlanetArtwork,
  "vector-planet": VectorPlanetArtwork,
  "battle-station": BattleStationArtwork,
  "ship-arrow": ArrowScoutArtwork,
  "ship-fang": FangInterceptorArtwork,
  "ship-crescent": CrescentCourierArtwork,
  "ship-twin-pod": TwinPodBomberArtwork,
  "ship-needle": NeedleFrigateArtwork,
  "ship-hammer": HammerCruiserArtwork,
  "monster-void-eye": VoidEyeArtwork,
  "monster-star-jelly": StarJellyArtwork,
  "monster-void-manta": VoidMantaArtwork,
  "monster-cosmic-serpent": CosmicSerpentArtwork,
  "monster-moon-maw": MoonMawArtwork,
  "monster-astral-kraken": AstralKrakenArtwork
};

export function LoopNodeArtwork({ nodeStyle }: { nodeStyle: LoopNodeStyle }) {
  const Artwork = loopNodeArtworkByStyle[nodeStyle];
  const group = loopNodeStyleCatalog[nodeStyle].group;
  return (
    <span
      aria-hidden="true"
      data-loop-node-artwork={nodeStyle}
      className={`loop-node-surface loop-node-surface--group-${group} loop-node-surface--${nodeStyle}`}
    >
      {Artwork ? <Artwork /> : null}
    </span>
  );
}
