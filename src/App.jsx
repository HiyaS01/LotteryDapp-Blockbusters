import { useState, useEffect } from "react";
import { ethers } from "ethers";
import { CONTRACT_ADDRESS, ABI } from "./contractConfig";

function App() {
  const [account, setAccount] = useState(null);
  const [contract, setContract] = useState(null);
  const [myTickets, setMyTickets] = useState(0);
  
  // 1. STATE FIX: We will use "isLoading" everywhere to be consistent
  const [isLoading, setIsLoading] = useState(false); 

  const [status, setStatus] = useState("");
  const [balance, setBalance] = useState("0");
  const [players, setPlayers] = useState([]);
  const [lastWinner, setLastWinner] = useState("None");

  // ---------------- CONNECT WALLET ----------------
  const connectWallet = async () => {
    try {
      if (!window.ethereum) return alert("MetaMask not installed!");

      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const address = await signer.getAddress();

      // Check Network (Sepolia is 11155111)
      const network = await provider.getNetwork();
      if (network.chainId !== 11155111n) {
        // Try to switch automatically
        try {
          await window.ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0xaa36a7' }], // Hex for 11155111
          });
        } catch (err) {
          return alert("Please switch your MetaMask network to Sepolia!");
        }
      }

      setAccount(address);
      const lotteryContract = new ethers.Contract(CONTRACT_ADDRESS, ABI, signer);
      setContract(lotteryContract);
      setStatus("Wallet connected.");

    } catch (error) {
      console.error(error);
      setStatus("Error connecting wallet.");
    }
  };

  // ---------------- BUY TICKET (FIXED & CLEANED) ----------------
  const buyTicket = async () => {
    if (!contract) return alert("Connect wallet first!");

    try {
      setIsLoading(true); // Start Spinner
      setStatus("Preparing transaction...");

      // Get current gas fees to prevent "Insufficient Funds" errors
      const feeData = await contract.runner.provider.getFeeData();
      
      // Send Transaction:
      // 1. Price is hardcoded to 0.01 to match your contract
      // 2. Gas Limit is forced to 300k to prevent estimation errors
      const tx = await contract.buyTicket({ 
        value: ethers.parseEther("0.01"), 
        gasLimit: 300000, 
        maxFeePerGas: feeData.maxFeePerGas, 
        maxPriorityFeePerGas: feeData.maxPriorityFeePerGas 
      });

      setStatus("Mining transaction... please wait...");
      await tx.wait(); 
      
      setStatus("Ticket purchased successfully! 🎉");
      loadInfo(); // Refresh data

    } catch (error) {
      console.error("FULL ERROR:", error);
      setStatus("Failed: " + (error.reason || error.code || "Check Console"));
    } finally {
      setIsLoading(false); // Stop Spinner (Fixes the crash)
    }
  };

  // ---------------- PICK WINNER ----------------
  const pickWinner = async () => {
    if (!contract) return alert("Connect wallet first!");

    try {
      setStatus("Picking winner...");
      const tx = await contract.pickWinner();
      await tx.wait();
      setStatus("Winner selected!");
      loadInfo();
    } catch (error) {
      console.error(error);
      setStatus("Error picking winner.");
    }
  };

  // ---------------- LOAD INFO ----------------
  const loadInfo = async () => {
    if (!contract) return;

    try {
      const bal = await contract.getBalance();
      setBalance(ethers.formatEther(bal));

      const p = await contract.getPlayers();
      setPlayers(p);

      const w = await contract.lastWinner();
      setLastWinner(w === "0x0000000000000000000000000000000000000000" ? "None" : w);

      const count = p.filter((addr) => addr.toLowerCase() === account?.toLowerCase()).length;
      setMyTickets(count);

    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (contract) loadInfo();
  }, [contract]);

  return (
    <div style={{ maxWidth: "600px", margin: "auto", fontFamily: "Arial", textAlign: "center", padding: "20px" }}>
      {/* CSS for Spinner */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spinner {
          margin: auto;
          border: 5px solid #f3f3f3;
          border-top: 5px solid #3498db;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
        }
      `}</style>

      <h1>🎉 Lottery DApp</h1>
      <p>Buy a ticket (0.01 SepoliaETH) → Admin picks winner → Winner gets all!</p>

      {!account ? (
        <button onClick={connectWallet} style={{padding: "10px 20px", fontSize: "16px"}}>Connect Wallet</button>
      ) : (
        <p><strong>Connected:</strong> {account.slice(0,6)}...{account.slice(-4)}</p>
      )}

      <hr />

      {/* --- BUY TICKET SECTION --- */}
      <h2>Buy Ticket</h2>
      
      {isLoading ? (
        <div className="spinner"></div>
      ) : (
        <button 
          onClick={buyTicket} 
          disabled={!account}
          style={{padding: "10px 20px", fontSize: "16px", backgroundColor: "#4CAF50", color: "white", border: "none", cursor: "pointer"}}
        >
          Buy Ticket (0.01 ETH)
        </button>
      )}

      <p style={{ marginTop: "15px", fontWeight: "bold", color: status.includes("Failed") ? "red" : "blue" }}>
        {status}
      </p>

      <hr />

      {/* --- ADMIN SECTION --- */}
      <h2>Pick Winner (Owner Only)</h2>
      <button onClick={pickWinner} style={{padding: "8px 16px"}}>Pick Winner</button>

      <hr />

      {/* --- INFO SECTION --- */}
      <h2>Lottery Info</h2>
      <button onClick={loadInfo}>Refresh Info</button>

      <p><strong>Contract Balance:</strong> {balance} ETH</p>
      <p><strong>My Tickets:</strong> {myTickets}</p>
      <p><strong>Last Winner:</strong> {lastWinner}</p>

      <p><strong>Players ({players.length}):</strong></p>
      <ul style={{listStyle: "none", padding: 0}}>
        {players.map((p, i) => <li key={i} style={{fontSize: "12px"}}>{p}</li>)}
      </ul>

    </div>
  );
}

export default App;
