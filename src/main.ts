import './style.css'
import Phaser from 'phaser'

// ゲームの設定
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO, // ブラウザに合わせて最適な描画モード（WebGLかCanvas）を自動選択
  width: 800,        // ゲーム画面の幅
  height: 600,       // ゲーム画面の高さ
  parent: 'app',     // HTMLの <div id="app"> の中にゲームを埋め込む
  backgroundColor: '#2d2d2d', // 背景色（ダークグレー）
  physics: {
    default: 'arcade', // シンプルな物理演算モードを使用
    arcade: {
      gravity: { x: 0, y: 0 }, // 重力設定（今はゼロ）
      debug: false
    }
  },
  scene: {
    preload: preload,
    create: create,
    update: update
  }
};

// ゲームインスタンスの作成
new Phaser.Game(config);

// 1. 画像などの素材を読み込む場所
function preload(this: Phaser.Scene) {
  // 今はまだ何もしない
}

// 2. 画面にオブジェクトを配置する場所
function create(this: Phaser.Scene) {
  // 動作確認用のテキストを表示
  this.add.text(400, 300, 'Cyber Raid Initiated...', { 
    fontSize: '32px', 
    color: '#00ff00' 
  }).setOrigin(0.5);
}

// 3. 毎フレーム実行されるループ処理
function update(this: Phaser.Scene) {
  // 今はまだ何もしない
}