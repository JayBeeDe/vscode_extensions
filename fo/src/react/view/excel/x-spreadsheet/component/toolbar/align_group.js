import Item from './item';
import Icon from '../icon';
import { t } from '../../locale/locale';

class AlignButton extends Item {
  constructor(tag, value) {
    super(tag, '', value);
    // the tooltip names the alignment, not the group: "Align center"
    this.tip = t(`${tag}.${value}`);
    this.el.attr('data-tooltip', this.tip);
  }

  element() {
    return super.element()
      .child(new Icon(`align-${this.value}`))
      .on('click', () => this.change(this.tag, this.value));
  }
}

/**
 * One button per alignment (`align`: left, center, right; `valign`: top, middle, bottom), the
 * current one shown active: an alignment is a single click, with no dropdown to open.
 */
export default class AlignGroup {
  constructor(tag, values, value) {
    this.buttons = values.map((it) => new AlignButton(tag, it));
    this.setState(value);
  }

  setState(value) {
    this.buttons.forEach((button) => button.el.active(button.value === value));
  }
}
