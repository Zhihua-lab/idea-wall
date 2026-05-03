/** 列表卡片视觉轮换（与 Stitch 三卡一致），不改变语义类名。 */
export const LIST_CARD_VARIANTS = [
  {
    cardArticleClass: 'relative group',
    washiTapeClass: 'absolute -top-4 left-1/4 w-24 h-6 washi-tape z-10 bg-secondary-container/40',
    innerCardClass:
      'relative bg-white p-8 folded-corner shadow-[4px_4px_0px_rgba(0,0,0,0.05)] transform rotate-1 hover:rotate-0 transition-all border border-surface-container-highest',
    primaryTagClass: 'text-label-sm font-bold text-primary px-3 py-1 bg-primary-fixed rounded-full',
    authorAvatarClass: 'bg-tertiary-fixed text-tertiary',
  },
  {
    cardArticleClass: 'relative group mt-4 lg:mt-8',
    washiTapeClass:
      'absolute -top-3 right-1/3 w-20 h-5 washi-tape z-10 bg-primary-container/30 transform rotate-3',
    innerCardClass:
      'relative bg-yellow-50 p-8 folded-corner shadow-[4px_4px_0px_rgba(0,0,0,0.05)] transform -rotate-1 hover:rotate-0 transition-all border border-surface-container-highest',
    primaryTagClass: 'text-label-sm font-bold text-tertiary px-3 py-1 bg-tertiary-fixed rounded-full',
    authorAvatarClass: 'bg-secondary-fixed text-secondary',
  },
  {
    cardArticleClass: 'relative group lg:mt-[-20px]',
    washiTapeClass:
      'absolute -top-5 left-10 w-28 h-7 washi-tape z-10 bg-secondary-fixed-dim/40 transform -rotate-2',
    innerCardClass:
      'relative bg-orange-50 p-8 folded-corner shadow-[4px_4px_0px_rgba(0,0,0,0.05)] transform rotate-2 hover:rotate-0 transition-all border border-surface-container-highest',
    primaryTagClass: 'text-label-sm font-bold text-secondary px-3 py-1 bg-secondary-fixed rounded-full',
    authorAvatarClass: 'bg-primary-fixed-dim text-primary',
  },
] as const
