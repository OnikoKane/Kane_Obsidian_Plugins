# ZapTrace 示例题卡

把本文件放进 vault 任意位置，启用插件后打开阅读视图即可看到可交互题卡。

```zaptrace
id: demo-gaoshu-deriv-001
subject: 高等数学
tags: 导数, 极限
source: 示例 · 高等数学 第七版 p.86
difficulty: 3
---
### 题干

求 $f(x)=x^{2}$ 在 $x=1$ 处的导数，并写出定义式。

$$
\lim_{\Delta x\to 0}\frac{(1+\Delta x)^{2}-1}{\Delta x}
$$

### 答案

$f'(1)=2$。

先写增量比 $\dfrac{\Delta y}{\Delta x}=2+\Delta x$，再令 $\Delta x\to 0$。

### 个人笔记

- 关键是别漏掉「先增量比、再取极限」。
```

```zaptrace
id: demo-linear-algebra-002
subject: 线性代数
tags: 行列式
source: 示例 · 课堂笔记
---
### 题干

判断矩阵 $A=\begin{pmatrix}1&2\\3&4\end{pmatrix}$ 是否可逆。

### 答案

$\det A = 1\cdot4-2\cdot3=-2\neq 0$，所以可逆。
```

````zaptrace
id: demo-code-in-answer-003
subject: 离散数学
tags: 代码
---
### 题干

下面这段代码输出什么？

### 答案

```ts
const a = [1, 2, 3].map((x) => x * 2);
console.log(a);
```

输出 `[2, 4, 6]`。注意外层用了四个反引号，答案里的三反引号代码块不会截断题卡。
````

```zaptrace
subject: 概率论
tags: 概念
---
### 题干

（无手写 id，使用自动 ID；仅改答案或标签不会改变复习状态）

独立事件的定义是什么？

### 答案

$P(A\cap B)=P(A)P(B)$。
```
