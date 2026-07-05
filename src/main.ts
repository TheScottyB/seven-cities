const canvas = document.getElementById('game') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!
canvas.width = 960
canvas.height = 600
ctx.fillStyle = '#123'
ctx.fillRect(0, 0, canvas.width, canvas.height)
ctx.fillStyle = '#eee'
ctx.font = '20px monospace'
ctx.fillText('Seven Cities of Gold — booting…', 24, 40)
