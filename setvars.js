const fs = require('fs')

console.log(process.argv)

const iterArg = process.argv.filter((x) => x.startsWith('--iterations='))[0]
const iterations = iterArg ? parseInt(iterArg.split('=')[1]) : 25
const webArg = process.argv.filter((x) => x.startsWith('--page=http'))[0]
const webpage = webArg ? webArg.split('=')[1] : 'http://localhost:5000/table/7500';
const frameArg = process.argv.filter((x) => x.startsWith('--framework='))[0]
const framework = frameArg ? frameArg.split('=')[1] : null;

fs.writeFile('jestVars.js', `process.env.ITERATIONS = '${iterations}'\nprocess.env.PAGE = '${webpage}'\n${framework ? 'process.env.FRAMEWORK = \'' + framework +'\'' : ''}`, function (err) {
    if (err) return console.log(err);
    console.log('variables set');
});


console.log(iterations);
console.log(webpage)