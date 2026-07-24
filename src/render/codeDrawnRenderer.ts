import Phaser from 'phaser';
import type { RiderRenderer, RiderVisual } from './riderRenderer.ts';

/**
 * CodeDrawnRenderer (SPEC §8) — a rider on a bike drawn with Phaser `Graphics`.
 * A caricature, but a *believable* one: two wheels joined by a real frame
 * (seat tube, down tube, chain + seat stays, fork), handlebars off the head tube,
 * and a rider leaning onto the bars with a leg driving the cranks. Recolours the
 * jersey/helmet by one value; tiny footprint; scales crisp.
 *
 * Faces right (direction of travel). Roughly 24×20px, centred on (x, y).
 */
const SKIN = 0xf0c9a8;
const WHEEL = 0x20202f;
const HUB = 0x9a9ab0;
const TYRE = 0x30304a;

export class CodeDrawnRenderer implements RiderRenderer {
  draw(scene: Phaser.Scene, x: number, y: number, visual: RiderVisual): Phaser.GameObjects.Container {
    const g = scene.add.graphics();
    const jersey = visual.jerseyColor;
    const accent = visual.accentColor;

    const bx = -7; // rear hub
    const fx = 7; // front hub
    const wy = 5; // wheel centre line (ground-ish)
    const bb = 0; // bottom-bracket x
    const seat = { x: -2.5, y: -3 }; // saddle
    const head = { x: 6, y: -2 }; // head tube (front of frame)

    // --- wheels ---
    g.lineStyle(1.6, WHEEL, 1);
    g.strokeCircle(bx, wy, 4.4);
    g.strokeCircle(fx, wy, 4.4);
    g.lineStyle(0.8, TYRE, 0.9);
    g.strokeCircle(bx, wy, 3.1);
    g.strokeCircle(fx, wy, 3.1);
    g.fillStyle(HUB, 1);
    g.fillCircle(bx, wy, 1);
    g.fillCircle(fx, wy, 1);

    // --- frame (team accent) ---
    g.lineStyle(1.7, accent, 1);
    g.beginPath();
    g.moveTo(bx, wy); // rear hub
    g.lineTo(bb, wy); // chain stay → bottom bracket
    g.lineTo(seat.x, seat.y); // seat tube up to saddle
    g.lineTo(bx, wy); // seat stay back to rear hub
    g.moveTo(bb, wy); // bottom bracket
    g.lineTo(head.x, head.y); // down tube → head tube
    g.lineTo(fx, wy); // fork → front hub
    g.moveTo(seat.x, seat.y); // saddle
    g.lineTo(head.x, head.y); // top tube
    g.strokePath();

    // --- handlebar (off the head tube) ---
    g.lineStyle(1.5, WHEEL, 1);
    g.beginPath();
    g.moveTo(head.x, head.y);
    g.lineTo(8.4, -3.6);
    g.strokePath();

    // --- leg: thigh (shorts) then shin (skin) down onto the cranks ---
    g.lineStyle(2.6, WHEEL, 1);
    g.beginPath();
    g.moveTo(seat.x + 1, seat.y + 0.5);
    g.lineTo(1.8, 1.8); // knee
    g.strokePath();
    g.lineStyle(2, SKIN, 1);
    g.beginPath();
    g.moveTo(1.8, 1.8);
    g.lineTo(bb + 0.2, wy - 0.5); // to the pedal at the bottom bracket
    g.strokePath();

    // --- torso (jersey) leaning to the bars ---
    g.lineStyle(3.4, jersey, 1);
    g.beginPath();
    g.moveTo(seat.x + 1.5, seat.y - 0.5);
    g.lineTo(4.5, -8.5); // shoulders
    g.strokePath();

    // --- arm to the bars ---
    g.lineStyle(1.7, SKIN, 1);
    g.beginPath();
    g.moveTo(4.5, -8);
    g.lineTo(8.2, -3.3);
    g.strokePath();

    // --- helmeted head ---
    g.fillStyle(jersey, 1);
    g.fillCircle(5.6, -10.8, 2.5); // helmet
    g.fillStyle(SKIN, 1);
    g.fillCircle(6.3, -9.7, 1.8); // face (front of helmet)

    const container = scene.add.container(x, y, [g]);
    container.setSize(24, 20);

    if (visual.emphasised) {
      // halo + white ring so the player's riders pop out of any bunch
      const halo = scene.add.circle(0, -3, 12, jersey, 0.28);
      const ring = scene.add.circle(0, -3, 12).setStrokeStyle(1.5, 0xffffff, 0.9);
      container.addAt(halo, 0);
      container.addAt(ring, 1);
    }

    return container;
  }
}
