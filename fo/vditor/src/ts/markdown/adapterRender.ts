export const mathRenderAdapter = {
    getCode: (mathElement: Element) => mathElement.textContent,
    getElements: (element: HTMLElement) => element.querySelectorAll(".language-math"),
};
export const mermaidRenderAdapter = {
    /** must not only return the code, but also set it as the innerHTML of el */
    getCode: (el: Element) => el.textContent,
    getElements: (element: HTMLElement) => element.querySelectorAll(".language-mermaid"),
};
