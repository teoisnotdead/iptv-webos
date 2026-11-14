import "./polyfills";
import "./styles/global.css";
import { render } from "preact";
import { App } from "./App";
import { applyBrand } from "./brand";
import { installNavigation } from "./nav/spatial";

applyBrand();
installNavigation();
render(<App />, document.getElementById("app")!);
