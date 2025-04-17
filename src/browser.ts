import {typestripped} from "./typestripped.js";

export async function transpile(tsE: Element): Promise<void> {
    let tsCode: string;
    
    // Check if there's a src attribute
    const src = tsE.getAttribute('src');
    if (src) {
        // Fetch the TypeScript file
        const response = await fetch(src);
        if (!response.ok) {
            throw new Error(`Failed to fetch ${src}: ${response.status} ${response.statusText}`);
        }
        tsCode = await response.text();
    } else {
        // Use inline code
        tsCode = tsE.textContent || '';
    }
    
    // Convert TypeScript to JavaScript
    const jsE = document.createElement('script');
    jsE.textContent = typestripped(tsCode, false, true); // Enable error recovery
    jsE.setAttribute('type', 'module');
            
    // Replace the TypeScript script with the JavaScript one
    tsE.parentNode!.replaceChild(jsE, tsE);
}

export async function transpileAll(): Promise<void> {
    const tsEs = document.querySelectorAll('script[type="text/typescript"]');
    for (const tsE of tsEs) {
        try {
            await transpile(tsE);
        } catch(e) {
            console.error(e);
        }
    }
}

document.addEventListener('DOMContentLoaded', transpileAll);