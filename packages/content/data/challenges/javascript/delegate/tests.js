// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { delegate } from './solution.js';

/** Builds <ul> with one <li> per label, each holding a delete button with an icon inside it. */
function makeList(labels) {
  const list = document.createElement('ul');
  for (const label of labels) addItem(list, label);
  document.body.append(list);
  return list;
}

function addItem(list, label) {
  const item = document.createElement('li');
  item.dataset.id = label;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'delete';
  const icon = document.createElement('span');
  icon.className = 'icon';
  icon.textContent = '×';
  button.append(icon, ` Delete ${label}`);
  item.append(label, button);
  list.append(item);
  return item;
}

describe('delegate', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('calls the handler with the event and the matching element', () => {
    const list = makeList(['milk', 'eggs']);
    const handler = vi.fn();
    delegate(list, 'click', 'button.delete', handler);

    const button = list.querySelectorAll('button')[1];
    button.click();
    expect(handler).toHaveBeenCalledTimes(1);
    const [event, match] = handler.mock.calls[0];
    expect(event.type).toBe('click');
    expect(match).toBe(button);
  });

  it('finds the matching element when the click lands on something inside it', () => {
    const list = makeList(['milk']);
    const handler = vi.fn();
    delegate(list, 'click', 'button.delete', handler);

    list.querySelector('.icon').click();
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0][1]).toBe(list.querySelector('button'));
  });

  it('ignores events that match nothing', () => {
    const list = makeList(['milk']);
    const handler = vi.fn();
    delegate(list, 'click', 'button.delete', handler);

    list.querySelector('li').click();
    list.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it('handles elements added after it was set up', () => {
    const list = makeList([]);
    const handler = vi.fn();
    delegate(list, 'click', 'button.delete', handler);

    const item = addItem(list, 'bread');
    item.querySelector('button').click();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('only counts matches inside root, even when an ancestor of root matches too', () => {
    const outer = document.createElement('li');
    outer.className = 'card';
    const root = document.createElement('div');
    const inner = document.createElement('span');
    root.append(inner);
    outer.append(root);
    document.body.append(outer);
    const handler = vi.fn();
    delegate(root, 'click', '.card', handler);

    inner.click();
    expect(handler).not.toHaveBeenCalled();
  });

  it('listens for the event type it was given', () => {
    const list = makeList(['milk']);
    const handler = vi.fn();
    delegate(list, 'focusin', 'button.delete', handler);

    list.querySelector('button').click();
    expect(handler).not.toHaveBeenCalled();
    list.querySelector('button').dispatchEvent(new FocusEvent('focusin', { bubbles: true }));
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('returns a function that removes the listener', () => {
    const list = makeList(['milk']);
    const handler = vi.fn();
    const stop = delegate(list, 'click', 'button.delete', handler);

    stop();
    list.querySelector('button').click();
    expect(handler).not.toHaveBeenCalled();
  });
});
