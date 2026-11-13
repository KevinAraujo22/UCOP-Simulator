/**
 * Selo exigido pela Licença da Comunidade de Ordem Paranormal, com o aviso de
 * material gerado por IA ao lado (o código deste app foi escrito com IA).
 */
export function LicenseSeal({ large = false }: { large?: boolean }) {
  return (
    <div className={`license-seal ${large ? 'large' : ''}`}>
      <img src="/selo-comunidade.png" alt="Selo: não-oficial, comunidade, não-canônico" />
      <div className="license-text">
        <strong>Contém material gerado por inteligência artificial</strong>
        <span>
          Conteúdo não oficial, publicado sob a{' '}
          <a href="https://ordemparanormal.com.br/licenca" target="_blank" rel="noreferrer">
            Licença da Comunidade
          </a>
          .
        </span>
      </div>
    </div>
  );
}
