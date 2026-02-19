import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import DemoView from './pages/DemoView'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/demo/:demoId/:step?" element={<DemoView />} />
    </Routes>
  )
}

export default App
