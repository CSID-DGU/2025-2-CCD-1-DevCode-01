import { createGlobalStyle } from "styled-components";
import { colors, contrastMap } from "./colors";

const baseVar = Object.entries(colors.base)
  .map(([k, v]) => `--c-${k}: ${v};`)
  .join("\n");

const hcVar = Object.entries(contrastMap)
  .map(([baseKey, hcKey]) => `--c-${baseKey}: ${colors.hc[hcKey]};`)
  .join("\n");

const GlobalStyle = createGlobalStyle`

  :root {
    ${baseVar}
    --ui-scale: 1;
  }
  // 고대비 모드
  html.hc {
    ${hcVar}
  }

  .app-zoom {
  position: fixed;
  inset: 0;                 
  transform-origin: top left;
  transform: scale(var(--ui-scale));
  width: calc(100vw / var(--ui-scale));
  height: calc(100vh / var(--ui-scale));
  overflow: auto;           
}


*{box-sizing:border-box}
body, button, dd, dl, dt, fieldset, form, h1, h2, h3, h4, h5, h6, input, legend, li, ol, p, select, table, td, textarea, th, ul {margin:0;padding:0}
body, button, input, select, table, textarea {font-size:12px;border:none;font-family:"Pretendard GOV Variable",-apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", helvetica, "Apple SD Gothic Neo", sans-serif}
h1, h2, h3, h4, h5, h6 {font-size:inherit;line-height:inherit}
textarea {-webkit-backface-visibility:hidden;backface-visibility:hidden;background-color:transparent;border:0;word-break:keep-all;word-wrap:break-word;outline:none;}
button, input {-webkit-border-radius:0;border-radius:0;border:none;outline: none;}
button {background-color:transparent;border:none;outline: none;}
fieldset, img {border:0}
img {vertical-align:top}
ol, ul {list-style:none}
address, em {font-style:normal}
a {display:flex;text-decoration:none;}
iframe {overflow:hidden;margin:0;border:0;padding:0;vertical-align:top}
mark {background-color:transparent}
i {font-style:normal}

html, body, #root { height: 100%; }
#root {
	display: flex;
	flex-direction: column;
	min-height: 100vh;
  width: 100%;
	

}

// 초기 html 설정
html {
	background-color: var(--c-white);
	justify-content: center;
	align-items: center;
  min-height: 100vh;

	-webkit-touch-callout: none;
    -webkit-tap-highlight-color:rgb(0 0 0 / 0%);
    scroll-behavior: smooth; 


}

body {
	width: 100vw;
	max-width: 100%;
  min-height: 100vh;
	background-color: var(--c-white);
	color: var(--c-black);
  font-synthesis: none;
	scrollbar-width: none; 
	-ms-overflow-style: none;

	::-webkit-scrollbar {
    display: none;
}

}


*::-webkit-scrollbar {
  display: none;
}

* {
  -ms-overflow-style: none; /* 인터넷 익스플로러 */
  scrollbar-width: none; /* 파이어폭스 */
}

&:focus {
    outline: none;
  }

  button {
  background-color: transparent;
  border: none;
  outline: none;
  box-shadow: none;
}

button:focus,
button:active {
  outline: none;
  border: none;
  box-shadow: none;
}


`;

export default GlobalStyle;
