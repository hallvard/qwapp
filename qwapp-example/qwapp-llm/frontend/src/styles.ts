import { css } from 'lit';

export const viewStyles = css`
  :host {
    display: block;
    font-family: system-ui, sans-serif;
  }
  h2 {
    margin: 0 0 0.75rem;
  }
  table {
    border-collapse: collapse;
  }
  th,
  td {
    text-align: left;
    padding: 0.25rem 1rem 0.25rem 0;
  }
  th {
    border-bottom: 1px solid #ccc;
  }
  td.number,
  th.number {
    text-align: right;
  }
  .families {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0;
    list-style: none;
  }
  .families button {
    font: inherit;
    padding: 0.75rem 1.25rem;
    cursor: pointer;
  }
  .families small {
    display: block;
    color: #666;
  }
  .error {
    color: #b00020;
  }
  dl {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 0.25rem 1rem;
  }
  dt {
    font-weight: bold;
  }
  dd {
    margin: 0;
  }
  a {
    color: inherit;
  }
`;
