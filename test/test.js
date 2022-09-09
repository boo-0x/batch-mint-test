describe("************** Test ******************", () => {
  MAX_STORAGE_LIMIT = ethers.BigNumber.from("0xffffffff");
  MAX_GAS_LIMIT = ethers.BigNumber.from("0xffffffffffffffff");

  before(async () => {
    /*
    NUM_OF_ITEMS |  Gas used  |  REEF spent  |  Storage limit
           1        1,119,860        18.57          1,100
          10        4,866,921       217.29         11,000
          50       21,180,724     1,049.29         55,000
          70       29,338,536     1,465.33         77,000
          80       33,417,670     1,673.33         88,000
          87       36,273,155     1,818.93         96,000
          88        Error: 0: out of gas or fund 
    */
    NUM_OF_ITEMS = 88;
    STORAGE_LIMIT = 100_000;
    GAS_LIMIT = 50_000_000;

    // Leave empty to deploy new contracts in local network
    nftContractAddress = "";
    marketContractAddress = "";
    if (hre.network.name == "reef_testnet") {
      nftContractAddress = "0x1A511793FE92A62AF8bC41d65d8b94d4c2BD22c3";
      marketContractAddress = "0x0a3F2785dBBC5F022De511AAB8846388B78009fD";
    } else if (hre.network.name == "reef_mainnet") {
      nftContractAddress = "0x0601202b75C96A61CDb9A99D4e2285E43c6e60e4";
      marketContractAddress = "0xB13Be9656B243600C86922708C20606f5EA89218";
    }

    [user, userAddress] = await getSignerAndAddress(
      hre.network.name == "reef" ? "alice" : "account1"
    );

    let newNftContract = false;
    const NFT = await reef.getContractFactory("SqwidERC1155", user);
    if (!nftContractAddress || nftContractAddress == "") {
      newNftContract = true;
      nft = await NFT.deploy();
      await nft.deployed();
      nftContractAddress = nft.address;
    } else {
      nft = await NFT.attach(nftContractAddress);
    }
    console.log(`\tNFT contract deployed in ${nftContractAddress}`);

    const Market = await reef.getContractFactory("SqwidMarketplace", user);
    if (!marketContractAddress || marketContractAddress == "") {
      market = await Market.deploy(250, nftContractAddress);
      await market.deployed();
      marketContractAddress = market.address;
    } else {
      market = Market.attach(marketContractAddress);
      if (newNftContract)
        await market.setNftContractAddress(nftContractAddress);
    }
    console.log(`\tMarket contract deployed in ${marketContractAddress}`);
  });

  it("Mint batch", async () => {
    const amounts = [];
    const uris = [];
    const mimetypes = [];
    const royaltyReceivers = [];
    const royaltyAmounts = [];

    for (let i = 0; i < NUM_OF_ITEMS; i++) {
      amounts.push(1);
      uris.push("ipfs://test");
      mimetypes.push("image");
      royaltyReceivers.push(userAddress);
      royaltyAmounts.push(1000);
    }

    const iniBalance = await user.getBalance();

    const tx = await market.mintBatch(
      amounts,
      uris,
      mimetypes,
      royaltyReceivers,
      royaltyAmounts,
      {
        gasLimit: GAS_LIMIT,
        customData: { storageLimit: STORAGE_LIMIT },
      }
    );

    const receipt = await tx.wait();
    console.log(`Minted ${Math.ceil(receipt.events.length / 2) - 1} items`);

    const itemIds = [];
    for (let i = 1; i < receipt.events.length; i += 2) {
      itemIds.push(receipt.events[i].args["itemId"].toNumber());
    }
    console.log(`Item ids: ${itemIds}`);

    const endBalance = await user.getBalance();
    console.log(`Gas used: ${receipt.gasUsed}`);
    console.log(`REEF cost: ${Number(iniBalance.sub(endBalance)) / 1e18}`);
  });
});

getSignerAndAddress = async (name) => {
  const signer = await reef.getSignerByName(name);
  if (!(await signer.isClaimed())) {
    console.log(`\tClaiming default account for ${name}...`);
    await signer.claimDefaultAccount();
  }
  const address = await signer.getAddress();

  const balance = Number(await signer.getBalance()) / 1e18;
  console.log(`\tBalance of ${name}: ${balance}`);

  return [signer, address];
};
