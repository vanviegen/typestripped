import { typestripped } from "./typestripped.js";
let transformCache = {};
function transformImport(url) {
    // Do we need to translate?
    if (url.slice(-3) === '.js')
        return url;
    const absoluteUrl = new URL(url, location.href).toString();
    let objectUrl = transformCache[absoluteUrl];
    if (!objectUrl) {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', absoluteUrl, false); // false for synchronous request
        xhr.send(null);
        if (xhr.status !== 200) {
            throw new Error(`HTTP error! status: ${xhr.status} for ${absoluteUrl}`);
        }
        const ts = xhr.responseText;
        const js = typestripped(ts, { recover: true, transformImport }) + "\n//# sourceURL=" + url;
        const blob = new Blob([js], { type: 'application/javascript' });
        objectUrl = URL.createObjectURL(blob);
        transformCache[absoluteUrl] = objectUrl;
    }
    console.log(`typestripped browser transformed import`, absoluteUrl, objectUrl);
    return objectUrl;
}
export async function transpile(tsE) {
    let ts;
    // Check if there's a src attribute
    const src = tsE.getAttribute('src');
    if (src) {
        // Fetch the TypeScript file
        const response = await fetch(src);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${src}: ${response.status} ${response.statusText}`);
        }
        ts = await response.text();
    }
    else {
        // Use inline code
        ts = tsE.textContent || '';
    }
    // Convert TypeScript to JavaScript
    const jsE = document.createElement('script');
    let js = typestripped(ts, { recover: true, transformImport });
    if (src)
        js += "\n//# sourceURL=" + src;
    jsE.textContent = js;
    jsE.setAttribute('type', 'module');
    // Replace the TypeScript script with the JavaScript one
    tsE.parentNode.replaceChild(jsE, tsE);
}
export async function transpileAll() {
    const tsEs = document.querySelectorAll('script[type="text/typescript"]');
    for (const tsE of tsEs) {
        try {
            await transpile(tsE);
        }
        catch (e) {
            console.error(e);
        }
    }
}
document.addEventListener('DOMContentLoaded', transpileAll);
//# sourceMappingURL=browser.js.map