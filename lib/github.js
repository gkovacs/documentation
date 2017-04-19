'use strict';
/* @flow */

var path = require('path');
var fs = require('fs');
var findGit = require('../lib/git/find_git');
var getGithubURLPrefix = require('../lib/git/url_prefix');
require('livescript-async');
var alias_utils = require('../lib/alias_utils.ls');

var alias_info = alias_utils.get_alias_info();

function get_first_line_with_occurrence(code, match) {
  var lines = code.split('\n');
  for (var i = 0; i < lines.length; ++i) {
    if (lines[i].includes(match)) {
      return i;
    }
  }
  return 0;
}

function fix_import_path(import_path) {
  for (var x of alias_info) {
    if (x.frontend == import_path || x.backend == import_path) {
      return x.path;
    }
  }
  return import_path;
}

/**
 * Attempts to link code to its place on GitHub.
 *
 * @name linkGitHub
 * @param {Object} comment parsed comment
 * @return {Object} comment with github inferred
 */
module.exports = function(comment /*: Comment*/) {
  var repoPath = findGit(comment.context.file);
  var root = repoPath ? path.dirname(repoPath) : '.';
  var urlPrefix = getGithubURLPrefix(root);
  var fileRelativePath = comment.context.file
    .replace(root + path.sep, '')
    .split(path.sep)
    .join('/');

  if (urlPrefix) {
    if (comment.context.code.startsWith('/* livescript */')) {
      var livescriptPath = fileRelativePath;
      if (livescriptPath.includes('src_gen/')) {
        livescriptPath = livescriptPath.replace('src_gen/', 'src/');
      }
      if (livescriptPath.endsWith('.js')) {
        livescriptPath = livescriptPath.replace(/\.js$/, '.ls');
      }
      var code = comment.context.code;
      if (fs.existsSync(livescriptPath)) {
        code = fs.readFileSync(livescriptPath, 'utf-8');
      }
      var start_line = 0;
      //var export_name =
      if (comment.name && comment.name.length > 0) {
        if (code.includes('export ' + comment.name + ' = ')) {
          start_line = get_first_line_with_occurrence(
            code,
            'export ' + comment.name + ' = '
          );
        } else if (code.includes(comment.name + ' = ')) {
          start_line = get_first_line_with_occurrence(
            code,
            comment.name + ' = '
          );
        } else if (code.includes('export ' + comment.name)) {
          start_line = get_first_line_with_occurrence(
            code,
            'export ' + comment.name
          );
        } else {
          start_line = get_first_line_with_occurrence(code, comment.name);
        }
      }
      var import_path = livescriptPath
        .replace(/^src\//, '')
        .replace(/\.ls$/, '');
      import_path = fix_import_path(import_path);
      comment.context.github = urlPrefix +
        livescriptPath +
        '#L' +
        (start_line + 1);
      comment.context.path = 'import {' +
        comment.name +
        "} from '" +
        import_path +
        "'";
    } else {
      var javascriptPath = fileRelativePath;
      if (javascriptPath.includes('src_gen/')) {
        javascriptPath = javascriptPath.replace('src_gen/', 'src/');
      }
      comment.context.github = urlPrefix +
        javascriptPath +
        '#L' +
        comment.context.loc.start.line +
        '-' +
        'L' +
        comment.context.loc.end.line;
      var import_path = javascriptPath
        .replace(/^src\//, '')
        .replace(/\.js$/, '');
      import_path = fix_import_path(import_path);
      comment.context.path = (comment.context.path = 'import {' +
        comment.name +
        "} from '" +
        import_path +
        "'");
    }
  }
  return comment;
};
