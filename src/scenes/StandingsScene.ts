import Phaser from 'phaser';
import { riderStandings, teamStandings } from '../sim/season.ts';
import { dynastyTeamColor, dynastyTeamName, rosterById, teamOf, type DynastyState } from '../state/dynasty.ts';
import { Button, makeButton } from '../ui/button.ts';
import { COLORS, FONT } from '../ui/theme.ts';

/** Season standings (SPEC §6): individual and team rankings by points. */
export class StandingsScene extends Phaser.Scene {
  private dynasty!: DynastyState;
  private mode: 'riders' | 'teams' = 'riders';
  private listItems: Phaser.GameObjects.GameObject[] = [];
  private riderBtn!: Button;
  private teamBtn!: Button;

  constructor() {
    super('Standings');
  }

  create(data: { dynasty: DynastyState }): void {
    this.dynasty = data.dynasty;
    this.listItems = [];
    const { width } = this.scale;

    makeButton(this, 40, 34, '‹', () => this.scene.start('SeasonHub', { dynasty: this.dynasty }), { width: 40, height: 34, fontSize: 20 });
    this.add.text(width / 2, 30, 'Standings', { fontFamily: FONT, fontSize: '23px', fontStyle: 'bold', color: COLORS.text }).setOrigin(0.5);

    this.riderBtn = makeButton(this, width / 2 - 82, 74, 'Riders', () => this.setMode('riders'), { width: 150, height: 34, fontSize: 15 });
    this.teamBtn = makeButton(this, width / 2 + 82, 74, 'Teams', () => this.setMode('teams'), { width: 150, height: 34, fontSize: 15 });

    this.render();
  }

  private setMode(mode: 'riders' | 'teams'): void {
    this.mode = mode;
    this.render();
  }

  private render(): void {
    const { width } = this.scale;
    this.riderBtn.setSelected(this.mode === 'riders');
    this.teamBtn.setSelected(this.mode === 'teams');
    for (const it of this.listItems) it.destroy();
    this.listItems = [];

    const byId = rosterById(this.dynasty);
    const season = this.dynasty.season;
    const top = 112;
    const rowH = this.mode === 'riders' ? 30 : 44;
    const rows =
      this.mode === 'riders'
        ? riderStandings(season).slice(0, 22).map((r) => ({ id: r.id, name: byId.get(r.id)!.name, teamId: byId.get(r.id)!.teamId, points: r.points }))
        : teamStandings(season, (id) => teamOf(this.dynasty, id)).map((t) => ({ id: t.id, name: dynastyTeamName(this.dynasty, t.id), teamId: t.id, points: t.points }));

    if (rows.length === 0) {
      this.listItems.push(this.add.text(width / 2, top + 20, 'No points yet — ride a race.', { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(0.5));
      return;
    }

    rows.forEach((row, i) => {
      const y = top + i * rowH + 14;
      const isPlayer = row.teamId === this.dynasty.playerTeamId;
      if (isPlayer) this.listItems.push(this.add.rectangle(width / 2, y, width - 22, rowH - 4, COLORS.buttonSelected, 0.12));
      if (i === 0) this.listItems.push(this.add.rectangle(width / 2, y, width - 22, rowH - 4, COLORS.gold, 0.1));
      this.listItems.push(this.add.text(34, y, `${i + 1}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5));
      const col = dynastyTeamColor(this.dynasty, row.teamId);
      this.listItems.push(this.add.rectangle(48, y, 10, 10, col.jersey, 1));
      this.listItems.push(this.add.text(64, y, row.name, { fontFamily: FONT, fontSize: this.mode === 'riders' ? '14px' : '16px', fontStyle: i === 0 ? 'bold' : 'normal', color: i === 0 || isPlayer ? COLORS.accentText : COLORS.text }).setOrigin(0, 0.5));
      this.listItems.push(this.add.text(width - 24, y, `${row.points}`, { fontFamily: FONT, fontSize: '13px', color: COLORS.textMuted }).setOrigin(1, 0.5));
    });
  }
}
