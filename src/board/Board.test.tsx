import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Board } from './Board';
import { START_FEN } from '@/rules';

test('text move entry submits a legal SAN move and announces it', async () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  const input = screen.getByLabelText('Type a move');
  await userEvent.type(input, 'e4{enter}');
  expect(onMove).toHaveBeenCalledWith({ from: 'e2', to: 'e4', uci: 'e2e4', san: 'e4' });
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/e4/);
});

test('text move entry accepts UCI too', async () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  await userEvent.type(screen.getByLabelText('Type a move'), 'g1f3{enter}');
  expect(onMove).toHaveBeenCalledWith({ from: 'g1', to: 'f3', uci: 'g1f3', san: 'Nf3' });
});

test('text move entry reports an illegal move without calling onMove', async () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  await userEvent.type(screen.getByLabelText('Type a move'), 'e5{enter}');
  expect(onMove).not.toHaveBeenCalled();
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent(/not a legal move/i);
});

test('keyboard navigation: arrows move the cursor, Enter selects then moves', () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} textEntry />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  grid.focus();
  // cursor starts at a1 for white; go to e2: right x4, up x1
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' }); fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onMove).toHaveBeenCalledWith(expect.objectContaining({ uci: 'e2e4' }));
});

test('selectable mode reports square taps instead of moves', () => {
  const onSelect = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="select" onSelectSquare={onSelect} textEntry />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  grid.focus();
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onSelect).toHaveBeenCalledWith('a1');
});

test('disabled board ignores keyboard activation', () => {
  const onMove = vi.fn();
  render(<Board fen={START_FEN} orientation="w" mode="play" onMove={onMove} disabled />);
  const grid = screen.getByRole('application', { name: /chess board/i });
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowRight' }); fireEvent.keyDown(grid, { key: 'ArrowRight' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  fireEvent.keyDown(grid, { key: 'ArrowUp' }); fireEvent.keyDown(grid, { key: 'ArrowUp' });
  fireEvent.keyDown(grid, { key: 'Enter' });
  expect(onMove).not.toHaveBeenCalled();
});

test('announce prop overrides the internal status', () => {
  render(<Board fen={START_FEN} orientation="w" mode="static" announce="Puzzle solved" />);
  expect(screen.getByRole('status', { name: 'Board announcements' })).toHaveTextContent('Puzzle solved');
});
