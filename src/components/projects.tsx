import dfacapitalLogo from "../assets/dfacapital/dfacapitalLogoPink@2x.png";
import gremlinLogo from "../assets/gremlin/gremlinLogo@2x.png";
import statypeLogo from "../assets/statype/statype.gif";
import dfacapital from "../pages/work/dfacapital.astro";
import gremlin from "../pages/work/gremlin.astro";
import statype from "../pages/work/statype.astro";

export const projects = [
  {
    component: gremlin,
    slug: "gremlin",
    thumb: gremlinLogo,
    img_alt: "Gremlin Thumbnail",
    title: "Gremlin Project",
  },
  {
    component: statype,
    slug: "statype",
    thumb: statypeLogo,
    img_alt: "Statype Thumbnail",
    title: "Statype Project",
  },
  {
    component: dfacapital,
    slug: "dfacapital",
    thumb: dfacapitalLogo,
    img_alt: "DFA Capital Thumbnail",
    title: "DFA Capital Identity",
  },
];
