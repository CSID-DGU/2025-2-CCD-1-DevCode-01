import { createGlobalStyle } from "styled-components";

const GlobalStyle = createGlobalStyle`
*{box-sizing:border-box}
body, button, dd, dl, dt, fieldset, form, h1, h2, h3, h4, h5, h6, input, legend, li, ol, p, select, table, td, textarea, th, ul {margin:0;padding:0}
body, button, input, select, table, textarea {font-size:12px;border:none;font-family:-apple-system, BlinkMacSystemFont, "Malgun Gothic", "맑은 고딕", helvetica, "Apple SD Gothic Neo", sans-serif}
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

#root {
	display: flex;
	flex-direction: column;

	min-height: 100vh;
  width: 100%;
	

}

// 초기 html 설정
html {
	background-color: white;
	display: flex;
	justify-content: center;
	align-items: center;

	-webkit-touch-callout: none;
    -webkit-tap-highlight-color:rgb(0 0 0 / 0%);
    scroll-behavior: smooth; 

	/* @media (max-width: 360px) {
		font-size:12px;
	} */

}

body {
	width: 100vw;
  //TODO: max-width 확인 필요
	max-width: 440px;
	overflow-x: hidden;
	background-color: white;
	color: black;
  font-synthesis: none;
	scrollbar-width: none; 
	-ms-overflow-style: none;
  border: 1px solid black;

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
