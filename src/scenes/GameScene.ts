import Phaser from 'phaser';
import { ASSETS } from '../GameAssets'; // 画像データをインポート

export default class GameScene extends Phaser.Scene {
  private player!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private platforms!: Phaser.Physics.Arcade.Group;
  private enemies!: Phaser.Physics.Arcade.Group;
  private bg!: Phaser.GameObjects.TileSprite; // 背景用

  // 攻撃用
  private attackHitbox!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private isAttacking = false;

  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private attackKey!: Phaser.Input.Keyboard.Key;
  
  private swipeStartX = 0;
  private swipeStartY = 0;

  // ゲーム設定値
  private readonly GAME_SPEED = -250; // スピードアップ！
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
    // --- 画像データの読み込み ---
    // Base64データをPhaserのテクスチャとして登録
    this.textures.addBase64('player_img', ASSETS.player);
    this.textures.addBase64('enemy_img', ASSETS.enemy);
    this.textures.addBase64('platform_img', ASSETS.platform);
    this.textures.addBase64('bg_img', ASSETS.background);

    // 攻撃エフェクトはとりあえず四角形のまま（後でパーティクルにするため）
    if (!this.textures.exists('slash')) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffff00, 1);
        g.fillRect(0, 0, 48, 48);
        g.generateTexture('slash', 48, 48);
    }
  }

  create() {
    this.isLastHole = false;
    this.isAttacking = false;
    this.isGameOver = false;
    this.score = 0;

    // --- 1. 背景の作成（一番後ろに配置） ---
    // TileSprite: タイルのように画像を敷き詰めて表示する機能
    // 画面幅(800) x 高さ(600) のエリアに 'bg_img' を敷き詰める
    this.bg = this.add.tileSprite(400, 300, 800, 600, 'bg_img')
      .setScrollFactor(0); // カメラが動いても背景は固定（今回はカメラ固定なので念のため）
    
    // 背景を少し暗くする（手前のキャラを目立たせるため）
    this.bg.setTint(0x444444);

    // --- 2. グループ作成 ---
    this.platforms = this.physics.add.group({ allowGravity: false, immovable: true });
    this.enemies = this.physics.add.group({ allowGravity: true, immovable: false });

    // --- 3. 初期マップ生成 ---
    for (let i = 0; i < 30; i++) {
      this.createPlatform(i * 32, 584);
    }

    // --- 4. プレイヤー作成 ---
    // 画像('player_img')を使用
    this.player = this.physics.add.sprite(100, 450, 'player_img');
    this.player.setGravityY(1000);
    this.player.setCollideWorldBounds(true);
    (this.player.body as Phaser.Physics.Arcade.Body).onWorldBounds = true;
    
    // 当たり判定のサイズ調整（画像の余白を削る）
    this.player.body.setSize(20, 28);
    this.player.body.setOffset(6, 2);

    this.physics.world.setBoundsCollision(true, true, true, false);

    // --- 5. 攻撃判定 ---
    this.attackHitbox = this.physics.add.sprite(-100, -100, 'slash');
    this.attackHitbox.setVisible(false);
    this.attackHitbox.disableBody(true, true);

    // --- 6. UI作成 ---
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

    // --- 7. 衝突設定 ---
    this.physics.add.collider(this.player, this.platforms);
    this.physics.add.collider(this.enemies, this.platforms);
    this.physics.add.collider(this.player, this.enemies, () => { this.setGameOver(); });
    this.physics.add.overlap(this.attackHitbox, this.enemies, (hitbox, enemy) => {
       this.destroyEnemy(enemy as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody);
    });

    // --- 8. 入力設定 ---
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

    // --- 背景スクロール ---
    // 床よりも少しゆっくり動かすことで「遠近感（パララックス）」を出す
    // 床の速度(-250)に対して、背景は 2 (1/100くらい) ずつずらす
    this.bg.tilePositionX += 2;

    // スコア加算
    this.score += 0.1; 
    this.scoreText.setText('SCORE: ' + Math.floor(this.score));

    // --- 床・敵のリサイクル ---
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

    // --- 攻撃位置 ---
    if (this.isAttacking) {
        this.attackHitbox.x = this.player.x + 30;
        this.attackHitbox.y = this.player.y;
    }

    // --- 操作 ---
    if (this.cursors.space.isDown) {
      this.jump();
    }
    if (Phaser.Input.Keyboard.JustDown(this.attackKey)) {
        this.attack();
    }

    // --- 落下判定 ---
    if (this.player.y > 650) {
      this.setGameOver();
    }
  }

  // --- ヘルパー関数 (変更なし) ---
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
    platform.setOrigin(0.5, 0.5);
    platform.setVelocityX(this.GAME_SPEED);
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
    enemy.setOrigin(0.5, 0.5);
    enemy.setVelocityX(this.GAME_SPEED);
    enemy.setImmovable(true);
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