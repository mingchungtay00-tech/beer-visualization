import { BeerScene } from './beer/BeerScene';
import './styles.css';

const container = document.querySelector<HTMLDivElement>('#app');

if (!container) {
  throw new Error('Missing #app container.');
}

const beerScene = new BeerScene(container);
beerScene.start();
