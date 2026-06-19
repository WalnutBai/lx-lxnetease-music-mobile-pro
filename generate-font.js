const fs = require('fs')
const path = require('path')

// 使用 fonteditor-core 包生成字体
// 需要先安装: npm install fonteditor-core --save-dev

const selectionJsonPath = path.join(__dirname, 'src', 'resources', 'fonts', 'selection.json')
const outputTtfPath = path.join(__dirname, 'src', 'resources', 'fonts', 'icomoon.ttf')

const selection = JSON.parse(fs.readFileSync(selectionJsonPath, 'utf8'))

// 提取所有图标的 SVG 路径和码位
const glyphs = []
for (const icon of selection.icons) {
  const { name, code, paths } = icon.icon
  const props = icon.properties
  for (const d of paths) {
    glyphs.push({
      name,
      unicode: code,
      path: d,
      width: icon.icon.width || 1024,
    })
  }
}

console.log(`找到 ${glyphs.length} 个字形`)
console.log('请手动执行以下步骤生成字体文件:')
console.log('1. 访问 https://icomoon.io/app')
console.log('2. 点击 "Import Fonts" 导入 selection.json')
console.log('3. 选择所有图标，点击 "Generate Font"')
console.log('4. 下载字体文件并覆盖:', outputTtfPath)
