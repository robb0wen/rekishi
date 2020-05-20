const path = require('path');
const rollup = require('rollup');
const { babel } = require('@rollup/plugin-babel');
const { terser } = require('rollup-plugin-terser');

const useES5 = process.argv.includes('--es5');

const plugins = useES5
    ? [
        babel({ 
          exclude: 'node_modules/**',
          babelHelpers: 'bundled' 
        }),
        terser({
          output: {
            comments: function(node, comment) {
            var text = comment.value;
            var type = comment.type;
            if (type == "comment2") {
                // multiline comment
                return /@preserve|@license|@cc_on/i.test(text);
            }
            }
          }
        })
    ]
    : [
        terser({
            output: {
              comments: function(node, comment) {
              var text = comment.value;
              var type = comment.type;
              if (type == "comment2") {
                  // multiline comment
                  return /@preserve|@license|@cc_on/i.test(text);
              }
              }
            }
        })
    ];

const filename = useES5 ? 'rekishi.es5.js' : 'rekishi.js';

async function build() {
  const bundle = await rollup.rollup({
      input: path.join(__dirname,'/src/rekishi.js'),
      plugins
  });

  await bundle.write({
      format: 'umd',
      name: 'rekishi',
      file: path.join(__dirname, `/dist/${filename}`)
  });
};

build();