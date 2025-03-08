// ==UserScript==
// @name         Civitai Injector
// @version      2025-03-06
// @author       Theta
// @description  A prompt injector
// @match        https://civitai.com/generate
// @icon         https://www.google.com/s2/favicons?sz=64&domain=civitai.com
// @grant        GM_xmlhttpRequest
// ==/UserScript==
javascript:(function(){
    'use strict';
    function getBasenameWithoutExt(url) {
        const base = url.substring(url.lastIndexOf('/') + 1);
        return base.split('.').slice(0, -1).join('.') || base; 
    }
    function buildButton(text, callback) {
        const button = document.createElement("button");
        button.innerText = text;
        button.style.padding = ".5em 1em";
        button.style.background = "#007BFF";
        button.style.color = "white";
        button.style.border = "none";
        button.style.borderRadius = ".5em";
        button.style.cursor = "pointer";
        button.style.fontSize = "1.2em";
        button.style.boxShadow = ".2em .2em .5em rgba(0,0,0,0.2)";
        button.onmouseover = () => button.style.background = "#0056b3";
        button.onmouseout = () => button.style.background = "#007BFF";
        button.onclick = callback;
        return button;
    }
    function parseXML(xmlString) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        return {
            positivePrompt: xmlDoc.querySelector("positive-prompt")?.textContent,
            negativePrompt: xmlDoc.querySelector("negative-prompt")?.textContent,
            resourcesUrls: Array.from(xmlDoc.querySelectorAll("page-url").values()).map(result => result?.textContent),
            width: xmlDoc.querySelector("width")?.textContent,
            height: xmlDoc.querySelector("height")?.textContent,
            steps: xmlDoc.querySelector("steps")?.textContent,
            sampler: xmlDoc.querySelector("sampler")?.textContent,
            cfgScale: xmlDoc.querySelector("cfg-scale")?.textContent,
            seed: xmlDoc.querySelector("seed")?.textContent,
            clipSkip: xmlDoc.querySelector("clip-skip")?.textContent
        };
    };
    function openResouceWindows(resourcesUrls) {
        resourcesUrls.forEach(resourceUrl => {
            console.log("opening", resourceUrl);
            const resourceWindow = window.open(resourceUrl, "_blank");
            if (resourceWindow) {
                console.log("window opened at", resourceUrl);
            } else {
                console.error("Could not open a window for", resourceUrl);
            }
        });
    }
    function injectField(value, selector) {
        const element = document.querySelector(selector);
        if (element == null) {
            console.error("Could not select element of selector", selector);
        }
        element.value = value;
        if (element.value != value) {
            console.error("Could not change value of element of selector", selector);
        }
    }
    function extractPrompt() {
        const civitaiSelectors = {
            positivePromptArea: "#input_prompt",
            negativePromptArea: "#input_negativePrompt",
            cfgScaleHiddenInput: "#mantine-rf-panel-advanced > div > div > div > div.relative.flex.flex-col.gap-3 > div:nth-child(1) > div > div.mantine-Slider-root.flex-1.mantine-15k342w > input[type=hidden]",
            samplerHiddenInput: "#mantine-rf-panel-advanced > div > div > div > div.relative.flex.flex-col.gap-3 > div.mantine-InputWrapper-root.mantine-Select-root.mantine-1m3pqry > div > input[type=hidden]",
            stepsHiddenInput: "#mantine-rf-panel-advanced > div > div > div > div.relative.flex.flex-col.gap-3 > div:nth-child(3) > div > div.mantine-Slider-root.flex-1.mantine-15k342w > input[type=hidden]"
        };
        return {
            positivePrompt: document.querySelector(civitaiSelectors.positivePromptArea).value ?? null,
            negativePrompt: document.querySelector(civitaiSelectors.negativePromptArea).value ?? null,
            cfgScale: document.querySelector(civitaiSelectors.cfgScaleHiddenInput).value ?? null,
            sampler: document.querySelector(civitaiSelectors.samplerHiddenInput).value ?? null,
            steps: document.querySelector(civitaiSelectors.stepsHiddenInput).value ?? null
        };
    }
    function generatePromptXML(data) {
        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<civitai-ai-prompt>
    <prompt-details>
        <positive-prompt>${data.positivePrompt || ''}</positive-prompt>
        <negative-prompt>${data.negativePrompt || ''}</negative-prompt>
    </prompt-details>
    <image-parameters>
        <width>512</width>
        <height>512</height>
        <steps>${data.steps || 0}</steps>
        <sampler>${data.sampler || ''}</sampler>
        <cfg-scale>${data.cfgScale || 0}</cfg-scale>
        <seed></seed>
        <clip-skip></clip-skip>
    </image-parameters>
    <resources>
        <base-model>
            <hash></hash>
            <id></id>
            <version></version>
            <display-name></display-name>
            <page-url></page-url>
        </base-model>
    </resources>
</civitai-ai-prompt>`;
        return xml;
    }
    function downloadXML(data, filename) {
        const blob = new Blob([data], { type: 'application/xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    function injectPrompt(response) {
        const civitaiSelectors = {
            positivePromptArea: "#input_prompt",
            negativePromptArea: "#input_negativePrompt",
            cfgScaleHiddenInput: "#mantine-rf-panel-advanced > div > div > div > div.relative.flex.flex-col.gap-3 > div:nth-child(1) > div > div.mantine-Slider-root.flex-1.mantine-15k342w > input[type=hidden]",
            cfgScaleTextInput: "#mantine-rh",
            samplerHiddenInput: "#mantine-rf-panel-advanced > div > div > div > div.relative.flex.flex-col.gap-3 > div.mantine-InputWrapper-root.mantine-Select-root.mantine-1m3pqry > div > input[type=hidden]",
            samplerSearchInput: "#input_sampler",
            stepsHiddenInput: "#mantine-rf-panel-advanced > div > div > div > div.relative.flex.flex-col.gap-3 > div:nth-child(3) > div > div.mantine-Slider-root.flex-1.mantine-15k342w > input[type=hidden]",
            stepsTextInput: "#mantine-rj"
        };
        const parsedData = parseXML(response.response);
        injectField(parsedData.positivePrompt, civitaiSelectors.positivePromptArea);
        injectField(parsedData.negativePrompt, civitaiSelectors.negativePromptArea);
        injectField(parsedData.cfgScale, civitaiSelectors.cfgScaleHiddenInput);
        injectField(parsedData.cfgScale, civitaiSelectors.cfgScaleTextInput);
        injectField(parsedData.sampler, civitaiSelectors.samplerHiddenInput);
        injectField(parsedData.sampler, civitaiSelectors.samplerSearchInput);
        injectField(parsedData.steps, civitaiSelectors.stepsHiddenInput);
        injectField(parsedData.steps, civitaiSelectors.stepsTextInput);
    }
    function buildButtonsBar(promptUrls) {
        const bar = document.createElement("div");
        promptUrls.forEach((promptUrl) => {
            const basename = getBasenameWithoutExt(promptUrl)
            const sub = document.createElement("div");
            sub.appendChild(buildButton(basename + " injection", function() {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: promptUrl,
                    onload: injectPrompt
                });
            }));
            sub.appendChild(buildButton(basename + " resources", function() {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: promptUrl,
                    onload: function(response) {
                        const parsedData = parseXML(response.response);
                        openResouceWindows(parsedData.resourcesUrls)
                    }
                });
            }));
            sub.style.fontSize = "1em";
            sub.style.display = "flex";
            sub.style.flexDirection = "column"
            sub.style.gap = '.5vh';
            bar.appendChild(sub);
        })
        bar.appendChild(buildButton("extract as xml", function() {
            downloadXML(generatePromptXML(extractPrompt()))
        }));
        bar.style.position = "fixed";
        bar.style.fontSize = "1rem";
        bar.style.bottom = '3vh';
        bar.style.right = '5vw';
        bar.style.zIndex = "10000";
        bar.style.display = "flex";
        bar.style.gap = '.5vw';
        document.body.appendChild(bar);
    }

    const promptUrls = [
        // Insert Urls to xml prompt which implement civitai_prompt.xsd
    ];
    buildButtonsBar(promptUrls);
})();
