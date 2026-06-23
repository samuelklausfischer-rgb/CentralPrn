import { useState } from 'react'
import Contratos from './pages/Contratos.jsx'
import Financeiro from './pages/Financeiro.jsx'
import OrdemServico from './pages/OrdemServico.jsx'
import Clientes from './pages/Clientes.jsx'
import Financiamentos from './pages/Financiamentos.jsx'

function Sidebar({ active, onNavigate }) {
  return (
    <aside className="flex h-screen w-56 flex-col border-r border-gray-200 bg-[#0D2B55]">
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 px-5 border-b border-white/10">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F26522] font-bold text-white text-sm">
          P
        </div>
        <span className="font-semibold text-white tracking-wide text-sm">PRN Dashboard</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 p-3 pt-4">
        <NavItem icon={<IconContratos />} label="Contratos" active={active === 'contratos'} onClick={() => onNavigate('contratos')} />
        <NavItem icon={<IconFinanceiro />} label="Financeiro" active={active === 'financeiro'} onClick={() => onNavigate('financeiro')} />
        <NavItem icon={<IconFinanciamentos />} label="Financiamentos" active={active === 'financiamentos'} onClick={() => onNavigate('financiamentos')} />
        <NavItem icon={<IconOS />} label="Ordens de Serviço" active={active === 'ordemServico'} onClick={() => onNavigate('ordemServico')} />
        <NavItem icon={<IconClientes />} label="Clientes" active={active === 'clientes'} onClick={() => onNavigate('clientes')} />
      </nav>

      <div className="border-t border-white/10 p-4 text-xs text-white/40 text-center">
        PRN · MedImagem · 2026
      </div>
    </aside>
  )
}

function NavItem({ icon, label, active = false, onClick, disabled = false }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors
        ${active
          ? 'bg-[#F26522] text-white font-medium'
          : disabled
          ? 'text-white/30 cursor-not-allowed'
          : 'text-white/60 hover:bg-white/10 hover:text-white'
        }`}
    >
      <span className="h-4 w-4 shrink-0">{icon}</span>
      {label}
      {disabled && <span className="ml-auto text-[10px] text-white/30">em breve</span>}
    </button>
  )
}

function IconContratos() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
}
function IconFinanceiro() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}
function IconFinanciamentos() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 21h18M4 21V10l8-5 8 5v11M9 21v-6h6v6M5 10h14" />
    </svg>
  )
}
function IconOS() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  )
}
function IconClientes() {
  return (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

const PAGES = {
  contratos:      Contratos,
  financeiro:     Financeiro,
  financiamentos: Financiamentos,
  ordemServico:   OrdemServico,
  clientes:       Clientes,
}

export default function App() {
  const [active, setActive] = useState('contratos')
  const Page = PAGES[active] ?? Contratos

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar active={active} onNavigate={setActive} />
      <main className="flex-1 overflow-auto">
        <Page />
      </main>
    </div>
  )
}
