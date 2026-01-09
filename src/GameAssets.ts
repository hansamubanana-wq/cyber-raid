import Phaser from 'phaser';

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private platforms!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bg!: Phaser.GameObjects.TileSprite;

  // 攻撃用
  private attackHitbox!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private isAttacking = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  
  private swipeStartX = 0;
  private swipeStartY = 0;

  // ゲーム設定
  private readonly GAME_SPEED = -250;
  private readonly JUMP_POWER = -500;
  
  private isLastHole = false;

  // UI
  private score = 0;
  private scoreText!: Phaser.GameObjects.Text;
  private gameOverText!: Phaser.GameObjects.Text;
  private isGameOver = false;

  constructor() {
    super('GameScene');
  }

  preload() {
    // --- 1. ドット絵をプログラムで生成 ---
    // これなら画像ファイルの読み込みエラーは絶対に起きません
    
    // プレイヤー（ロボット風）：青と白
    this.createPixelTexture('player_img', [
      '..7777..',
      '.773377.',
      '.733337.',
      '.777777.',
      '..7..7..',
      '.77..77.',
      '.7....7.',
      '33....33'
    ], { '7': '#00ccff', '3': '#ffffff', '.': null });

    // 敵（ドローン風）：赤と黒
    this.createPixelTexture('enemy_img', [
      '.2....2.',
      '222..222',
      '.222222.',
      '..2002..',
      '.222222.',
      '2......2'
    ], { '2': '#ff0044', '0': '#000000', '.': null });

    // 床（サイバーブロック）：緑と黒
    this.createPixelTexture('platform_img', [
      '55555555',
      '50000005',
      '50....05',
      '50....05',
      '50....05',
      '50....05',
      '50000005',
      '55555555'
    ], { '5': '#00ff00', '0': '#004400', '.': '#002200' });

    // 攻撃エフェクト（スラッシュ）
    if (!this.textures.exists('slash')) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffff00, 1);
        g.fillRect(0, 0, 48, 48);
        g.generateTexture('slash', 48, 48);
    }
  }

  create() {
    // 変数リセット
    this.isLastHole = false;
    this.isAttacking = false;
    this.isGameOver = false;
    this.score = 0;

    // --- 背景 (簡易的なグリッド描画) ---
    // 画像を使わず、プログラムでグリッド模様のテクスチャを作る
    if (!this.textures.exists('bg_pattern')) {
        const bgG = this.make.graphics({ x: 0, y: 0, add: false });
        bgG.fillStyle(0x111111); // ベースの暗い色
        bgG.fillRect(0, 0, 64, 64);
        bgG.lineStyle(2, 0x333333); // グリッド線
        bgG.strokeRect(0, 0, 64, 64);
        bgG.generateTexture('bg_pattern', 64, 64);
    }

    this.bg = this.add.tileSprite(400, 300, 800, 600, 'bg_pattern')
      .setScrollFactor(0);

    // --- グループ ---
    this.platforms = this.physics.add.group({ allowGravity: false, immovable: true });
    this.enemies = this.physics.add.group({ allowGravity: true, immovable: false });

    // --- 初期マップ ---
    for (let i = 0; i < 30; i++) {
      this.createPlatform(i * 32, 584);
    }

    // --- プレイヤー ---
    this.player = this.physics.add.sprite(100, 450, 'player_img');
    this.player.setScale(4); // ドット絵が小さい(8x8)ので4倍(32x32)に拡大
    
    // 当たり判定の調整
    this.player.body.setSize(6, 8); // ドット絵ベースの小さめの判定
    this.player.body.setOffset(1, 0);

    this.player.setGravityY(1000);
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).onWorldBounds = true;
    this.physics.world.setBoundsCollision(true, true, true, false);

    // --- 攻撃判定 ---
    this.attackHitbox = this.physics.add.sprite(-100, -100, 'slash');
    this.attackHitbox.setVisible(false);
    this.attackHitbox.disableBody(true, true);

    // --- UI ---
    this.scoreText = this.add.text(16, 16, 'SCORE: 0', {
        fontSize: '32px',
        color: '#00ffff',
        fontFamily: 'Arial Black',
        stroke: '#000000',
        strokeThickness: 4
    }).setDepth(10);

    this.gameOverText = this.add.text(400, 300, 'GAME OVER\nClick to Restart', {
        fontSize: '64px',
        color: '#ff0055',
        fontFamily: 'Arial Black',
        stroke: '#000000',
        strokeThickness: 6,
        align: 'center'
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // --- 衝突 ---
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.player, this.enemies, () => { this.setGameOver(); });
    this.physics.add.overlap(this.attackHitbox, this.enemies, (hitbox, enemy) => {
       this.destroyEnemy(enemy as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody);
    });

    // --- 入力 ---
    if (this.input.keyboard) {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.attackKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z);
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        if (this.isGameOver) {
            this.scene.restart();
            return;
        }
        this.swipeStartX = pointer.x;
        this.swipeStartY = pointer.y;
        this.jump(); 
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (this.isGameOver) return;
        const dist = pointer.x - this.swipeStartX;
        if (dist > 30) this.attack();
    });
  }

  update() {
    if (this.isGameOver) return;

    // 背景スクロール
    this.bg.tilePositionX += 2;

    this.score += 0.1; 
    this.scoreText.setText('SCORE: ' + Math.floor(this.score));

    // リサイクル処理
    this.platforms.children.iterate((child: Phaser.GameObjects.GameObject) => {
      const platform = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      if (platform.x < -50) this.recyclePlatform(platform);
      return true;
    });

    this.enemies.children.iterate((child: Phaser.GameObjects.GameObject) => {
      const enemy = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
      if (enemy.x < -50) enemy.destroy();
      return true;
    });

    if (this.isAttacking) {
        this.attackHitbox.x = this.player.x + 30;
        this.attackHitbox.y = this.player.y;
    }

    if (this.cursors.space.isDown) this.jump();
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) this.attack();

    if (this.player.y > 650) this.setGameOver();
  }

  // --- ヘルパー関数 ---

  // ★重要：ドット絵を生成する関数（ここが今回の肝です！）
  private createPixelTexture(key: string, rows: string[], palette: { [key: string]: string | null }) {
    if (this.textures.exists(key)) return; // 既にあったら作らない

    const w = rows[0].length;
    const h = rows.length;
    const canvas = this.textures.createCanvas(key, w, h);
    if (!canvas) return;

    const ctx = canvas.context;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const char = rows[y][x];
        const color = palette[char];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    canvas.refresh();
  }

  private setGameOver() {
      if (this.isGameOver) return;
      this.isGameOver = true;
      this.physics.pause();
      this.player.setTint(0xff0000);
      this.gameOverText.setVisible(true);
  }

  private destroyEnemy(enemy: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody) {
      enemy.destroy();
      this.score += 100;
      this.scoreText.setText('SCORE: ' + Math.floor(this.score));
  }

  private attack() {
      if (this.isAttacking) return;
      this.isAttacking = true;
      this.attackHitbox.setVisible(true);
      this.attackHitbox.enableBody(true, this.player.x + 30, this.player.y, true, true);
      this.time.delayedCall(100, () => {
          this.attackHitbox.setVisible(false);
          this.attackHitbox.disableBody(true, true);
          this.isAttacking = false;
      });
  }

  private createPlatform(x: number, y: number) {
    const platform = this.platforms.create(x, y, 'platform_img') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    platform.setScale(4); // 8x8 -> 32x32
    platform.setOrigin(0.5, 0.5);
    platform.setVelocityX(this.GAME_SPEED);
    // 物理判定サイズ調整
    platform.body.setSize(8, 8); 
  }

  private recyclePlatform(platform: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody) {
    const rightmostX = this.getRightmostPlatformX();
    const nextX = rightmostX + 32;

    if (!this.isLastHole && Math.random() < 0.15) {
      platform.disableBody(true, true);
      this.isLastHole = true;
      platform.x = nextX; 
    } else {
      platform.enableBody(true, nextX, 584, true, true);
      platform.setVelocityX(this.GAME_SPEED);
      this.isLastHole = false;

      if (rightmostX > 800 && Math.random() < 0.1) {
        this.spawnEnemy(nextX, 536);
      }
    }
  }

  private spawnEnemy(x: number, y: number) {
    const enemy = this.enemies.create(x, y, 'enemy_img') as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    enemy.setScale(4); // 8x8 -> 32x32
    enemy.setOrigin(0.5, 0.5);
    enemy.setVelocityX(this.GAME_SPEED);
    enemy.setImmovable(true);
    // 物理判定サイズ調整
    enemy.body.setSize(6, 6);
  }

  private jump() {
    if (this.player.body.touching.down) {
      this.player.setVelocityY(this.JUMP_POWER);
    }
  }

  private getRightmostPlatformX(): number {
    let maxX = -Infinity;
    this.platforms.children.iterate((child: Phaser.GameObjects.GameObject) => {
        const platform = child as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
        if (platform.x > maxX) maxX = platform.x;
        return true;
    });
    return maxX;
  }
}