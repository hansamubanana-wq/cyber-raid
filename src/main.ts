import './style.css'
import Phaser from 'phaser'
import GameScene from './scenes/GameScene'

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'app',
  backgroundColor: '#1d212d', // 少しリッチな暗い色に変更
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 }, // 全体の重力は0（プレイヤー個別に設定するため）
      debug: false // 当たり判定を可視化したい時は true にする
    }
  },
  // 作成した GameScene をリストに登録
  scene: [GameScene],
  
  // スマホ対応：画面サイズに合わせて拡大縮小する設定
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
};

new Phaser.Game(config);