import { scenes } from "../musicData";
import { setSceneResolver } from "../sceneExecution";

setSceneResolver((id) => scenes.find((s) => s.id === id));
