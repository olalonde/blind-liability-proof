var Tree = require('./tree'),
  crypto = require('crypto');

function sha256 (data) {
  return crypto.createHash('sha256').update(data).digest('base64');
}

function combine_nodes (left_node, right_node) {
  var n = {};
  n.value = left_node.value + right_node.value;
  n.hash = sha256((left_node.value + right_node.value) +
                  '' + left_node.hash + '' + right_node.hash);
  return n;
}

// @todo: since all nodes are at same tree level, this might
// leak information about number of users. randomize tree structure!?
// add fake nodes with 0 balance? maybe all right leaf node should be a dummy user?
function generate_private_tree (accounts) {
  // Make sure number of nodes is odd so we don't have a lonely leaf
  if (accounts.length % 2 === 0) accounts.push({ user: 'dummy', amount: 0 });

  // Generate initial hash / value for leaf nodes
  accounts.forEach(function (account) {
    account.hash = account.user; //sha256(account.user);
    account.value = account.balance;
    delete account.balance;
    delete account.user;
  });

  // Accounts must be on the leaf nodes of the tree
  // so we need to find out how many interior nodes we should generate.
  //
  // The number of nodes n in a perfect binary tree can be found using this formula:
  // n = 2l-1 where l is the number of leaf nodes in the tree.

  var l = accounts.length; // number of leafs
  var n = 2 * l - 1; // number of nodes
  var i = n - l; // number of interior nodes

  // Fill beginning of the array with "interior nodes"
  var arr = (new Array(i)).concat(accounts);

  var tree = Tree.fromArray(arr);
  //console.log(tree);

  tree.reverseLevelTraverse(function (node) {
    if (!node.data) {
      node.data = combine_nodes(tree.left(node).data, tree.right(node).data);
    }
  });

  return tree;
}

function extract_public_tree (private_tree, hash) {
  // shallow!? clone private tree and remove irrelevant nodes
  var public_tree = private_tree.clone();

  var node = public_tree.reverseLevelSearch(function (node) {
    return (node.data.hash === hash);
  });

  if (!node) throw new Error('Could not find node with hash ' + hash);

  var path = public_tree.extractPath(node);
  var selected_nodes = path.slice(0);

  //console.log(path);
  // we have the path from the node to the roor
  // now we need to make sure the sibbling of each node
  // is selected as well
  path.forEach(function (node) {
    var sibbling = public_tree.sibbling(node);
    if (sibbling) {
      selected_nodes.push(public_tree.sibbling(node));
    }
  });

  // We have now selected all relevant nodes, we can delete
  // the irrelevant nodes
  public_tree.slice(selected_nodes);

  return public_tree;
}

function verify_tree (tree) {
  var success = true;
  tree.reverseLevelTraverse(function (node) {
    if (!node) return;

    var left = tree.left(node);
    var right = tree.right(node);
    if (!left) return;

    var combined_node = combine_nodes (left.data, right.data);

    success = node.data.value === combined_node.value && 
        node.data.hash === combined_node.hash;
  });

  return success;

}

module.exports.generatePrivateTree = generate_private_tree;
module.exports.extractPublicTree = extract_public_tree;
module.exports.verifyTree = verify_tree;
