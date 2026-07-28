import Phaser from 'phaser';
import { RACES_BY_ID } from '../data/races.ts';
import { dynastyTeamName, rosterById, type DynastyState } from '../state/dynasty.ts';
import { makeButton } from '../ui/button.ts';
import { ScrollView } from '../ui/scrollView.ts';
import { COLORS, FONT } from '../ui/theme.ts';

export class WorldHistoryScene extends Phaser.Scene {
  constructor() {
    super('WorldHistory');
  }

  create(data: { dynasty: DynastyState }): void {
    const { width, height } = this.scale;
    const world = data.dynasty.world;
    makeButton(this, 40, 34, '<', () => this.scene.start('SeasonHub', { dynasty: data.dynasty }), {
      width: 40,
      height: 34,
      fontSize: 20,
    });
    this.add.text(width / 2, 28, 'World History', {
      fontFamily: FONT,
      fontSize: '22px',
      fontStyle: 'bold',
      color: COLORS.text,
    }).setOrigin(0.5);
    if (!world) {
      this.add.text(width / 2, 110, 'World history begins in a generated Dynasty.', {
        fontFamily: FONT,
        fontSize: '13px',
        color: COLORS.textMuted,
      }).setOrigin(0.5);
      return;
    }

    this.add.text(width / 2, 58, `${world.history.raceWinners.length} events  ·  ${world.history.stageWinners.length} stage winners  ·  ${world.history.promotions.length} completed seasons`, {
      fontFamily: FONT,
      fontSize: '10px',
      color: COLORS.textMuted,
    }).setOrigin(0.5);

    const byId = rosterById(data.dynasty);
    const seasonNumbers = new Set([
      data.dynasty.seasonNumber,
      ...world.history.seasons.map((entry) => entry.season),
      ...world.history.raceWinners.map((entry) => entry.season),
    ]);
    const seasons = [...seasonNumbers].sort((left, right) => right - left);
    const rowCount = seasons.reduce(
      (count, season) => count + 3 + world.history.raceWinners.filter((entry) => entry.season === season).length,
      0,
    );
    const view = new ScrollView(this, 82, height - 16, 96 + rowCount * 34, width);
    let y = 92;
    for (const season of seasons) {
      const summary = world.history.seasons.find((entry) => entry.season === season);
      const movement = world.history.promotions.find((entry) => entry.season === season);
      view.add(this.add.rectangle(width / 2, y + 16, width - 24, 32, COLORS.panelAlt, 1));
      view.add(this.add.text(20, y + 16, `SEASON ${season}${summary ? '  COMPLETE' : '  IN PROGRESS'}`, {
        fontFamily: FONT,
        fontSize: '11px',
        fontStyle: 'bold',
        color: summary ? COLORS.accentText : COLORS.text,
      }).setOrigin(0, 0.5));
      y += 38;

      const champions = summary
        ? `World: ${summary.teamChampionIds.world ? dynastyTeamName(data.dynasty, summary.teamChampionIds.world) : '-'}  ·  Pro: ${summary.teamChampionIds.pro ? dynastyTeamName(data.dynasty, summary.teamChampionIds.pro) : '-'}  ·  Rider: ${summary.riderChampionId ? byId.get(summary.riderChampionId)?.name ?? summary.riderChampionId : '-'}`
        : 'Champions decided at season rollover';
      view.add(this.add.text(20, y, champions, {
        fontFamily: FONT,
        fontSize: '9px',
        color: COLORS.textMuted,
        wordWrap: { width: width - 40 },
      }));
      y += 28;

      if (movement) {
        const promoted = movement.promotedTeamIds.map((teamId) => dynastyTeamName(data.dynasty, teamId)).join(', ');
        const relegated = movement.relegatedTeamIds.map((teamId) => dynastyTeamName(data.dynasty, teamId)).join(', ');
        view.add(this.add.text(20, y, `UP ${promoted}  ·  DOWN ${relegated}`, {
          fontFamily: FONT,
          fontSize: '9px',
          color: COLORS.text,
          wordWrap: { width: width - 40 },
        }));
        y += 28;
      }

      const winners = world.history.raceWinners.filter((entry) => entry.season === season);
      if (winners.length === 0) {
        view.add(this.add.text(20, y, 'No event winners yet.', { fontFamily: FONT, fontSize: '11px', color: COLORS.textMuted }));
        y += 30;
      } else {
        for (const winner of winners) {
          const race = RACES_BY_ID.get(winner.raceId);
          view.add(this.add.text(22, y, race?.name ?? winner.raceId, {
            fontFamily: FONT,
            fontSize: '11px',
            color: COLORS.text,
          }).setOrigin(0, 0.5));
          view.add(this.add.text(width - 20, y, `${byId.get(winner.riderId)?.name ?? winner.riderId}  ·  ${dynastyTeamName(data.dynasty, winner.teamId)}`, {
            fontFamily: FONT,
            fontSize: '9px',
            color: COLORS.textMuted,
          }).setOrigin(1, 0.5));
          y += 30;
        }
      }
      y += 12;
    }
  }
}