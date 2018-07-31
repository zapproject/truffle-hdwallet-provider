var bip39 = require("bip39");
var hdkey = require('ethereumjs-wallet/hdkey');
var ProviderEngine = require("web3-provider-engine");
var FiltersSubprovider = require('web3-provider-engine/subproviders/filters.js');
var HookedSubprovider = require('web3-provider-engine/subproviders/hooked-wallet.js');
var ProviderSubprovider = require("web3-provider-engine/subproviders/provider.js");
var Web3 = require("web3");
var Transaction = require('ethereumjs-tx');

function HDWalletProvider(mnemonic, provider_url, address_index=0, num_addresses=1) {
  this.mnemonic = mnemonic;
  this.hdwallet = hdkey.fromMasterSeed(bip39.mnemonicToSeed(mnemonic));
  this.wallet_hdpath = "m/44'/60'/0'/0/";
  this.wallets = {};
  this.addresses = [];

  for (let i = address_index; i < address_index + num_addresses; i++){
    var wallet = this.hdwallet.derivePath(this.wallet_hdpath + i).getWallet();
    var addr = '0x' + wallet.getAddress().toString('hex');
    this.addresses.push(addr);
    this.wallets[addr] = wallet;
  }

  const tmp_accounts = this.addresses;
  const tmp_wallets = this.wallets;

  this.engine = new ProviderEngine();
  this.engine.addProvider(new HookedSubprovider({
    getAccounts: function(cb) { cb(null, tmp_accounts) },
    getPrivateKey: function(address, cb) {
      if (!tmp_wallets[address]) { return cb('Account not found'); }
      else { cb(null, tmp_wallets[address].getPrivateKey().toString('hex')); }
    },
    signTransaction: function(txParams, cb) {
      let pkey;
      if (tmp_wallets[txParams.from]) { pkey = tmp_wallets[txParams.from].getPrivateKey(); }
      else { cb('Account not found'); }
      var tx = new Transaction(txParams);
      tx.sign(pkey);
      var rawTx = '0x' + tx.serialize().toString('hex');
      cb(null, rawTx);
    }
  }));
  this.engine.addProvider(new FiltersSubprovider());

  if (provider_url.startsWith('http')) {
    this.engine.addProvider(new ProviderSubprovider(new Web3.providers.HttpProvider(provider_url)));
  }
  else if(provider_url.startsWith('ws')) {
    Web3.providers.WebsocketProvider.prototype.sendAsync = function (data, callback) {
      try {
        callback(null, this.send(data)); 
      }
      catch (err) {
        callback(err);        
      }
    };

    const ws = new Web3.providers.WebsocketProvider(provider_url);
    const sub = new ProviderSubprovider(ws);

    this.engine.addProvider(sub);
  }
  else {
    throw new Error("Unknown provider");
  }
  this.engine.start(); // Required by the provider engine.
};

HDWalletProvider.prototype.sendAsync = function() {
  this.engine.sendAsync.apply(this.engine, arguments);
};

HDWalletProvider.prototype.on = function(... arguments) {
  this.engine.on(... arguments);
};

HDWalletProvider.prototype.reconnect = function() {
  this.engine.reconnect.apply(this.engine, arguments);
};

HDWalletProvider.prototype.once = function() {
  this.engine.once.apply(this.engine, arguments);
};

HDWalletProvider.prototype.send = function() {
  return this.engine.send.apply(this.engine, arguments);
};

// returns the address of the given address_index, first checking the cache
HDWalletProvider.prototype.getAddress = function(idx) {
  console.log('getting addresses', this.addresses[0], idx)
  if (!idx) { return this.addresses[0]; }
  else { return this.addresses[idx]; }
}

// returns the addresses cache
HDWalletProvider.prototype.getAddresses = function() {
  return this.addresses;
}

module.exports = HDWalletProvider;
