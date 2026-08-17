import { r as e } from "./sanity-core.js";
//#region src/plugin-entry.ts
e();
var t = !1;
async function n(e) {
	if (t) return;
	t = !0;
	let { initSanity: n } = await import("./sanity-ui.js");
	n({ autoOpen: !0 });
}
async function r() {
	if (t || (await i(), t)) return;
	t = !0;
	let { initSanity: e } = await import("./sanity-ui.js");
	e({ autoOpen: !1 });
}
function i() {
	return new Promise((e) => {
		let t = !1, n = () => {
			t || (t = !0, clearTimeout(o), e());
		}, r = document.readyState === "complete", i = !1, a = () => {
			r && i && n();
		};
		if ("PerformanceObserver" in window) try {
			let e = new PerformanceObserver(() => {
				i = !0, e.disconnect(), a();
			});
			e.observe({
				type: "largest-contentful-paint",
				buffered: !0
			});
		} catch {
			i = !0;
		}
		else i = !0;
		r || window.addEventListener("load", () => {
			r = !0, a();
		}, { once: !0 });
		let o = setTimeout(n, 1e4);
		a();
	});
}
//#endregion
export { n as mount, r as mountOnLoad };
