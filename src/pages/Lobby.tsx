import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Lobby() {
  const navigate = useNavigate();
  const [name, setName] = useState(
    () => sessionStorage.getItem("meetjohn-name") ?? "",
  );


  const canJoin = name.trim().length > 0;
  const join = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canJoin) return;
    sessionStorage.setItem("meetjohn-name", name.trim());
    navigate("/call");
  };

  return (
    <div className="page">
      <main className="lobby">
        <h1>Meet, by John</h1>
        <form onSubmit={join}>
          <input
            autoFocus
            placeholder="your name"
            value={name}
            maxLength={30}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="primary" disabled={!canJoin}>
            join the call
          </button>
        </form>
      </main>
    </div>
  );
}
