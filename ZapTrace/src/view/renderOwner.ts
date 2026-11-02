import { Component, MarkdownRenderChild } from "obsidian";

/**
 * 渲染作用域（MarkdownRenderer 生命周期，REVIEW-implementation §3-①）。
 *
 * 每次 `render()` / `refresh()` 都新建一个 RenderScope，作为这一轮
 * `MarkdownRenderer.render(..., owner)` 的 owner；下一轮开始前先 `unload()`
 * 上一轮的 scope，让 Obsidian 清理其注册的 MarkdownRenderChild。
 * 绝不把插件实例当作所有渲染的长期 owner。
 */
export class RenderScope extends MarkdownRenderChild {
	constructor(containerEl: HTMLElement) {
		super(containerEl);
	}
}

/** 在指定父 Component 下新建一个已 load 的渲染作用域。 */
export function createRenderScope(parent: Component, containerEl: HTMLElement): RenderScope {
	return parent.addChild(new RenderScope(containerEl));
}
