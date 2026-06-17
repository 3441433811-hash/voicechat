import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import PreJoin from "./pages/PreJoin";
import Room from "./pages/Room";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/prejoin/:code" element={<PreJoin />} />
      <Route path="/room/:code" element={<Room />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
