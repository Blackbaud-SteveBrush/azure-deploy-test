module.exports = function (grunt) {
    'use strict';

    grunt.loadNpmTasks('grunt-html2js');
    grunt.loadNpmTasks('grunt-concat-sourcemap');
    grunt.loadNpmTasks('grunt-contrib-cssmin');
    grunt.loadNpmTasks('grunt-contrib-uglify');
    grunt.loadNpmTasks('grunt-contrib-sass');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.initConfig({
        buildPath: grunt.option('buildpath') || 'build',
        concat_sourcemap: {
            options: {
                sourcesContent: true,
                sourceRoot: '../..'
            },
            app: {
                files: {
                    '<%= buildPath %>/js/app.js': [
                        'bower_components/sortable/Sortable.js',
                        'bower_components/sortable/ng-sortable.js',
                        'bower_components/jquery-hotkeys/jquery.hotkeys.js',
                        'bower_components/marked/lib/marked.js',
                        'bower_components/to-markdown/dist/to-markdown.js',
                        'bower_components/bootstrap-markdown/js/bootstrap-markdown.js',
                        'bower_components/angular-sanitize/angular-sanitize.js',
                        'bower_components/angular-local-storage/dist/angular-local-storage.min.js',
                        'public/app/app.js',
                        'public/app/scripts/**/*.js',
                        'public/app/components/**/*.js',
                        'public/app/views/**/*.js',
                        'tmp/templates.js'
                    ]
                }
            }
        },
        copy: {
            libs: {
                files: [{
                    expand: true,
                    cwd: 'public/app/libs',
                    src: ['**/*'],
                    dest: '<%= buildPath %>/libs/'
                }]
            },
            fonts: {
                files: [{
                    expand: true,
                    cwd: 'public/app/fonts',
                    src: ['*'],
                    dest: '<%= buildPath %>/fonts/'
                }]
            },
            data: {
                files: [{
                    expand: true,
                    cwd: 'public/app/data/',
                    src: ['**/*.json'],
                    dest: '<%= buildPath %>/data/'
                }]
            },
            html: {
                files: [{
                    expand: true,
                    cwd: 'public/app/',
                    src: ['index.html'],
                    dest: '<%= buildPath %>'
                }]
            }
        },
        html2js: {
            app: {
                options: {
                    module: 'capabilities-catalog.templates',
                    quoteChar: '\'',
                    indentString: '    ',
                    singleModule: true,
                    htmlmin: {
                        collapseBooleanAttributes: true,
                        collapseWhitespace: true,
                        removeAttributeQuotes: true,
                        removeComments: true,
                        removeEmptyAttributes: true,
                        removeRedundantAttributes: true,
                        removeScriptTypeAttributes: true,
                        removeStyleLinkTypeAttributes: true
                    }
                },
                src: ['public/app/views/**/*.html', 'public/app/components/**/*.html'],
                dest: 'tmp/templates.js'
            }
        },
        sass: {
            options: {
                style: 'compressed'
            },
            app: {
                files: {
                    '<%= buildPath %>/css/app.min.css': 'public/app/styles/app.scss'
                }
            }
        },
        cssmin: {
            options: {
                shorthandCompacting: false,
                roundingPrecision: -1
            },
            combine: {
                files: {
                    '<%= buildPath %>/css/app.min.css': [
                        'bower_components/bootstrap-markdown/css/bootstrap-markdown.min.css',
                        '<%= buildPath %>/css/app.min.css'
                    ]
                }
            }
        },
        uglify: {
            options: {
                sourceMap: true,
                sourceMapIncludeSources: true
            },
            scripts: {
                options: {
                    sourceMapIn: '<%= buildPath %>/js/app.js.map'
                },
                src: ['<%= buildPath %>/js/app.js'],
                dest: '<%= buildPath %>/js/app.min.js'
            }
        },
        watch: {
            sass: {
                files: ['public/app/**/*.scss'],
                tasks: ['sass', 'cssmin']
            },
            scripts: {
                files: ['public/app/**/*.js'],
                tasks: ['concat_sourcemap:app', 'uglify:scripts']
            },
            templates: {
                files: ['public/app/components/**/*.html'],
                tasks: ['html2js', 'concat_sourcemap:app', 'uglify:scripts']
            },
            views: {
                files: ['public/app/views/**/*.html'],
                tasks: ['html2js', 'concat_sourcemap:app', 'uglify:scripts']
            }
        }
    });

    grunt.registerTask('build', [
        'html2js',
        'concat_sourcemap',
        'uglify',
        'sass',
        'cssmin',
        'copy',
        //'watch'
    ]);

    grunt.registerTask('default', 'build');
};
