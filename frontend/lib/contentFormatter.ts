export function formatLessonContent(markdown: string): string {
  if (!markdown) return '';

  let html = markdown;

  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-bold text-gray-900 mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold text-gray-900 mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold text-gray-900 mt-8 mb-4">$1</h1>');

  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>');

  // Convert italic
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');

  // Convert bullet points
  html = html.replace(/^- (.*$)/gim, '<li class="ml-6 mb-2">$1</li>');

  // Wrap consecutive <li> tags in <ul>
  html = html.replace(/(<li.*?<\/li>\n?)+/g, '<ul class="list-disc space-y-2 my-4">$&</ul>');

  // Convert numbered lists
  html = html.replace(/^\d+\. (.*$)/gim, '<li class="ml-6 mb-2">$1</li>');
  html = html.replace(/(<li class="ml-6.*?<\/li>\n?)+/g, '<ol class="list-decimal space-y-2 my-4">$&</ol>');

  // Convert paragraphs (lines separated by double newline)
  const paragraphs = html.split('\n\n');
  html = paragraphs
    .map(p => {
      if (p.trim().startsWith('<')) return p; // Already HTML
      if (p.trim() === '') return '';
      return `<p class="mb-4 leading-relaxed text-gray-800">${p.trim()}</p>`;
    })
    .join('\n');

  // Convert single line breaks to <br>
  html = html.replace(/\n/g, '<br/>');

  // Convert code blocks
  html = html.replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono">$1</code>');

  return html;
}
